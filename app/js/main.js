import {
    addProductRow,
    removeProductRow,
    addSupplierColumn,
    atualizarOuvintesTabCot,
    prenchTabCot
} from './table_utils.js'
import {
    buscarFornecedores,
    buscarCentrosCusto,
    buscarClassesOperacionais
} from './dados_p_selects.js';
import {
    customModal,
    executar_apiZoho
} from './utils.js'
import {
    adicionarCampoVenc,
    removerCampoVenc,
    mostrarCamposPagamento,
    adicionarLinhaClassificacao,
    removerLinhaClassificacao,
    preencherDadosPDC

} from './forms_utils.js';
import { CONFIG } from './config.js';

class Globais {
    constructor() {
        this.state = {
            baseClassesOperacionais: new Map(),
            baseFornecedores: new Map(),
            baseCentrosCusto: new Map(),
            ...CONFIG.INITIAL_STATE,
            ...CONFIG.APPS
        };

        return new Proxy(this.state, {
            get: (target, prop) => target[prop],
            set: (target, prop, value) => {
                target[prop] = value;
                return true;
            }
        });
    }
}
export const globais = new Globais();

// Inicia o processo
initGenericItems().catch(error => {
    console.error('Erro na inicialização:', error);
});

async function initGenericItems() {
    try {
        // 1. Executa searchPageParams e as buscas em paralelo
        const [paramsResult, fornecedores, centrosCusto, classesOperacionais] = await Promise.allSettled([
            searchPageParams(),
            buscarFornecedores(),
            buscarCentrosCusto(),
            buscarClassesOperacionais()
        ]);

        // Atualiza as bases globais (não precisa esperar searchPageParams)
        if (fornecedores.status === 'fulfilled') globais.baseFornecedores = fornecedores.value;
        if (centrosCusto.status === 'fulfilled') globais.baseCentrosCusto = centrosCusto.value;
        if (classesOperacionais.status === 'fulfilled') globais.baseClassesOperacionais = classesOperacionais.value;

        // 2. Configura os ouvintes após searchPageParams
        if (paramsResult.status === 'fulfilled') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', setupListenersAndInit);
            } else {
                await setupListenersAndInit();
            }
        }
    } catch (error) {
        console.error('Erro ao inicializar:', error);
    }
}

async function setupListenersAndInit() {
    // Configura os ouvintes
    const buttonActions = {
        "add-supplier-btn": () => addSupplierColumn(),
        "add-product-btn": () => addProductRow(),
        "remove-product-btn": (elemento) => customModal({ 
            botao: elemento, 
            tipo: 'remover_produto', 
            mensagem: 'Deseja realmente remover este produto?' 
        }).then(() => { removeProductRow(elemento) }),
        "save-btn": (elemento) => customModal({ 
            botao: elemento, 
            mensagem: 'Deseja realmente salvar esta cotação?' 
        }),
        "formas-pagamento": (elemento) => mostrarCamposPagamento(),
        "add-parcela": () => adicionarCampoVenc(),
        "remover-parcela": (elemento) => removerCampoVenc(elemento),
        "add-classificacao": () => adicionarLinhaClassificacao(),
        "remover-classificacao": (elemento) => removerLinhaClassificacao(elemento)
    };

    Object.entries(buttonActions).forEach(([className, action]) => {
        document.querySelectorAll(`.${className}`).forEach(elemento => {
            elemento.addEventListener("click", () => action(elemento));
        });
    });

    // 3. Inicia os processos em paralelo
    await executarProcessosParalelos();
}

async function executarProcessosParalelos() {
    console.log('[BUSCANDO DADOS DO ZOHO]');
    await ZOHO.CREATOR.init();

    // Executa processos em paralelo
    const tarefas = [
        processarAprovacaoCotacao(),
        processarDadosPDC(),
        processarDadosCotacao()
    ];

    await Promise.all(tarefas);
    // Finaliza o processo
    document.body.classList.remove('hidden');
    atualizarOuvintesTabCot();
}

async function processarAprovacaoCotacao() {
    if (globais.pag == "aprovar_cotacao") {
        function replaceSaveButton() {
            // Seleciona o contêiner onde o botão "Salvar" está localizado
            const saveBtnContainer = document.querySelector('.save-btn-container');

            // Remove o botão "Salvar" existente, se houver
            const saveButton = saveBtnContainer.querySelector('.save-btn');
            if (saveButton) {
                saveBtnContainer.removeChild(saveButton);
            }

            // Cria o botão "Aprovar"
            const approveButton = document.createElement('button');
            approveButton.className = 'approve-btn';
            approveButton.textContent = 'Aprovar';
            approveButton.onclick = function () {
                customModal({ botao: this, tipo: "aprov_cot", titulo: "Aprovar proposta", mensagem: "Tem certeza que deseja APROVAR a proposta do fornecedor selecionado?" });
            };

            // Cria o botão "Solicitar Ajuste"
            const adjustButton = document.createElement('button');
            adjustButton.className = 'adjust-btn';
            adjustButton.textContent = 'Solicitar Ajuste';
            adjustButton.onclick = function () {
                customModal({ botao: this, tipo: "ajustar_cot", titulo: "Solicitação de Ajuste", mensagem: "Por favor, descreva abaixo o ajuste que deseja fazer:" });
            };

            // Cria o botão "Arquivar"
            const archiveButton = document.createElement('button');
            archiveButton.className = 'archive-btn';
            archiveButton.textContent = 'Arquivar';
            archiveButton.onclick = function () {
                customModal({ botao: this, tipo: "arquivar_cot", titulo: "Arquivar", mensagem: "Você tem certeza de que deseja arquivar este registro?" });
            };

            // Adiciona os novos botões ao contêiner
            saveBtnContainer.appendChild(approveButton);
            saveBtnContainer.appendChild(adjustButton);
            saveBtnContainer.appendChild(archiveButton);
        }

        // Chame a função para substituir o botão "Salvar" pelos novos botões
        replaceSaveButton();
    }
}

async function processarDadosPDC() {
    const cPDC = "(" + (globais.numPDC ? 
        `numero_de_PDC=="${globais.numPDC}"` : 
        (globais.numPDC_temp ? `id_temp=="${globais.numPDC_temp}"` : "ID==0")) + ")";

    const respPDC = await executar_apiZoho({ 
        tipo: "busc_reg", 
        criterios: cPDC, 
        nomeR: globais.nomeRelPDC 
    });

    if (respPDC.code == 3000) {
        console.log("Tem PDC");
        globais.tipo = 'editar_pdc';
        console.log('[DADOS DO PDC] =>', JSON.stringify(respPDC));
        console.log('[DADOS CLASSIFICAÇÃO] =>', JSON.stringify(respPDC.data[0].Classificacao_contabil));
        preencherDadosPDC(respPDC);
    } else {
        console.log("Não tem PDC");
    }
}

async function processarDadosCotacao() {
    const cCot = "(" + (globais.numPDC ? 
        `numero_de_PDC=="${globais.numPDC}"` : 
        (globais.numPDC_temp ? `num_PDC_temp=="${globais.numPDC_temp}"` : "ID==0")) + ")";

    const respCot = await executar_apiZoho({ 
        tipo: "busc_reg", 
        criterios: cCot, 
        nomeR: globais.nomeRelCot 
    });

    if (respCot.code == 3000) {
        console.log("Tem Cotação");
        await prenchTabCot(respCot);
    } else {
        console.log("Não tem Cotação");
    }
}

/**
 * Adiciona navegação por pontos (dots) para as seções da página
 * 
 * @function addNavDots
 * @returns {void}
 * 
 * @description
 * Esta função implementa:
 * 1. Observador de interseção para detectar seções visíveis
 * 2. Atualização automática dos pontos de navegação
 * 3. Navegação suave ao clicar nos pontos
 * 
 * Funcionalidades:
 * - Monitora a visibilidade das seções usando IntersectionObserver
 * - Atualiza o ponto ativo quando uma seção está 50% visível
 * - Permite navegação suave ao clicar nos pontos
 * - Usa margem de detecção para melhor precisão
 * 
 * @example
 * // Adiciona navegação por pontos à página
 * addNavDots();
 */
function addNavDots() {
    // Adiciona o observer para as seções
    const sections = document.querySelectorAll('.section');
    const dots = document.querySelectorAll('.dot');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove a classe active de todos os dots
                dots.forEach(dot => dot.classList.remove('active'));

                // Adiciona a classe active ao dot correspondente
                const sectionId = entry.target.id.replace('section', '');
                const activeDot = document.querySelector(`.dot[data-section="${sectionId}"]`);
                if (activeDot) {
                    activeDot.classList.add('active');
                }
            }
        });
    }, {
        threshold: 0.5, // Ativa quando 50% da seção está visível
        rootMargin: '-10% 0px -10% 0px' // Cria uma margem de detecção
    });

    // Observa todas as seções
    sections.forEach(section => observer.observe(section));

    // Adiciona click event nos dots para navegação suave
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const sectionId = dot.dataset.section;
            const targetSection = document.getElementById(`section${sectionId}`);
            targetSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    });
}

async function searchPageParams() {
    await ZOHO.CREATOR.init()
        .then(() => ZOHO.CREATOR.UTIL.getQueryParams())
        .then(params => {
            if (params) {
                if (params.idPdc) {
                    globais.numPDC = params.idPdc;
                } else if (params.num_PDC_temp) {
                    globais.numPDC_temp = params.num_PDC_temp;
                }
                if (params.pag) {
                    globais.pag = params.pag;
                }
            }
        });
}