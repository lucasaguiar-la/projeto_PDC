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
    executar_apiZoho,
    formatToBRL
} from './utils.js'
import {
    adicionarCampoVenc,
    removerCampoVenc,
    mostrarCamposPagamento,
    adicionarLinhaClassificacao,
    removerLinhaClassificacao,
    preencherDadosPDC,
    setupPixValidation,
    atualizarValorTotalParcelas,
    atualizarValorTotalClassificacoes
} from './forms_utils.js';
import { CONFIG } from './config.js';

class Globais {
    constructor() {
        this.state = {
            baseClassesOperacionais: new Map(),
            baseFornecedores: new Map(),
            baseCentrosCusto: new Map(),
            idFornAprovado: null,
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
        // 1. Cria a Promise do allSettled
        const basesPromise = Promise.allSettled([
            buscarFornecedores().then(result => { globais.baseFornecedores = result; }),
            buscarCentrosCusto().then(result => { globais.baseCentrosCusto = result; }),
            buscarClassesOperacionais().then(result => { globais.baseClassesOperacionais = result; adicionarLinhaClassificacao(); })
        ]);

        // 2. Executa searchPageParams e espera seu resultado
        const paramsResult = await searchPageParams();

        // 3. Se não estiver na página criar_cotacao, aguarda as bases carregarem
        if (globais.pag !== "criar_cotacao") {
            await basesPromise;
        } else {
            // Se estiver na página criar_cotacao, executa em background
            void basesPromise.catch(console.error);

        }

        // 4. Configura os ouvintes
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupListenersAndInit);
        } else {
            await setupListenersAndInit();
        }

        console.log('[BUSCOU AS BASES]');
    } catch (error) {
        console.error('Erro ao inicializar:', error);
    }
}

async function setupListenersAndInit() {
    // Configura os ouvintes
    const buttonActions = {
        "add-supplier-btn": { handler: () => addSupplierColumn(), type: 'click' },
        "add-product-btn": { handler: () => addProductRow(), type: 'click' },
        "remove-product-btn": { 
            handler: (elemento) => customModal({ 
                botao: elemento, 
                tipo: 'remover_produto', 
                mensagem: 'Deseja realmente remover este produto?' 
            }).then(() => { removeProductRow(elemento) }),
            type: 'click'
        },
        "save-btn": { 
            handler: (elemento) => customModal({ 
                botao: elemento, 
                mensagem: 'Deseja realmente salvar esta cotação?' 
            }),
            type: 'click'
        },
        "formas-pagamento": { handler: (elemento) => mostrarCamposPagamento(), type: 'click' },
        "add-parcela": { handler: () => adicionarCampoVenc(), type: 'click' },
        "remover-parcela": { handler: (elemento) => removerCampoVenc(elemento), type: 'click' },
        "add-classificacao": { handler: () => adicionarLinhaClassificacao(), type: 'click' },
        "remover-classificacao": { handler: (elemento) => removerLinhaClassificacao(elemento), type: 'click' },
        "valor-parcela": { handler: (elemento) => { formatToBRL(elemento); atualizarValorTotalParcelas();}, type: 'blur' },
        "valor-classificacao": { handler: (elemento) => { formatToBRL(elemento); atualizarValorTotalClassificacoes();}, type: 'blur' },
        "": { handler: (elemento) => handleEnterKeyNavigation(elemento), type: 'keydown' }
    };

    /*
    "": { handler: () => setupPixValidation(), type: 'DOMContentLoaded' }
    */

    Object.entries(buttonActions).forEach(([className, config]) => {
        if (className === '') {
            // Para eventos globais como DOMContentLoaded
            if (config.type === 'DOMContentLoaded') {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', config.handler);
                } else {
                    config.handler();
                }
            } else {
                document.addEventListener(config.type, config.handler);
            }
        } else {
            // Para elementos específicos
            document.querySelectorAll(`.${className}`).forEach(elemento => {
                if (config.type === 'DOMContentLoaded') {
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', () => config.handler(elemento));
                    } else {
                        config.handler(elemento);
                    }
                } else {
                    elemento.addEventListener(config.type, () => config.handler(elemento));
                }
            });
        }
    });

    // Adicione esta linha
    setupSectionToggle();

    // 3. Inicia os processos em paralelo
    await executarProcessosParalelos();
}

async function executarProcessosParalelos() {
    console.log('[Page] =>', globais.pag);
    if (globais.pag != "criar_cotacao") {
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
    }
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
    } else if (globais.pag == "autorizar_pagamento") {
        function adicionarBotaoAutorizar() {
            // Seleciona o contêiner onde o botão "Salvar" está localizado
            const saveBtnContainer = document.querySelector('.save-btn-container');

            // Remove o botão "Salvar" existente, se houver
            const saveButton = saveBtnContainer.querySelector('.save-btn');
            if (saveButton) {
                saveBtnContainer.removeChild(saveButton);
            }

            // Cria o botão "Autorizar"
            const approveButton = document.createElement('button');
            approveButton.className = 'approve-btn';
            approveButton.textContent = 'Autorizar';
            approveButton.onclick = function () {
                customModal({ botao: this, tipo: "autorizar_pag", titulo: "Autorizar Pagamento", mensagem: "Tem certeza que deseja AUTORIZAR o pagamento deste PDC?" });
            };

            const rejectButton = document.createElement('button');
            rejectButton.className = 'adjust-btn';
            rejectButton.textContent = 'Suspender';
            rejectButton.onclick = function () {
                customModal({ botao: this, tipo: "suspender_pag", titulo: "Suspender Pagamento", mensagem: "Tem certeza que deseja SUSPENDER o pagamento deste PDC?" });
            };

            const closeButton = document.createElement('button');
            closeButton.className = 'archive-btn';
            closeButton.textContent = 'Fechar';
            closeButton.onclick = function () {
                window.close();
            };

            // Adiciona o botão "Autorizar" ao contêiner
            saveBtnContainer.appendChild(approveButton);
            saveBtnContainer.appendChild(rejectButton);
            saveBtnContainer.appendChild(closeButton);
        }
        adicionarBotaoAutorizar();
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
        (globais.numPDC_temp ? `num_PDC_temp=="${globais.numPDC_temp}"` : "ID==0")) + " && Ativo==true)";

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

    // Adiciona click event nos dots para navegaço suave
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

/**
 * Configura o comportamento de alternância (toggle) para as seções da página
 * 
 * Esta função adiciona event listeners aos cabeçalhos das seções para permitir
 * que o usuário expanda/recolha o conteúdo clicando neles.
 * 
 * Para cada cabeçalho de seção (.section-header):
 * - Adiciona um listener de clique
 * - Quando clicado, alterna a classe 'collapsed' tanto no cabeçalho quanto na seção
 * - A classe 'collapsed' controla a visibilidade/animação através do CSS
 */
function setupSectionToggle() {
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.nextElementSibling;
            if (section && section.classList.contains('section')) {
                section.classList.toggle('collapsed');
                header.classList.toggle('collapsed'); 
            }
        });
    });
}

// Adicionar esta nova função
function handleEnterKeyNavigation(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Previne a quebra de linha em textareas
        
        const activeElement = document.activeElement;
        const isShiftPressed = event.shiftKey;
        
        // Verifica se é uma célula da tabela
        if (activeElement.closest('td')) {
            const currentCell = activeElement;
            const currentRow = currentCell.parentElement;
            const currentIndex = Array.from(currentRow.cells).indexOf(currentCell);
            const targetRow = isShiftPressed ? currentRow.previousElementSibling : currentRow.nextElementSibling;
            
            // Verifica se a linha alvo existe e não é uma linha especial
            if (targetRow && !targetRow.classList.contains('linhas-totalizadoras') && !targetRow.classList.contains('borda-oculta')) {
                const targetCell = targetRow.cells[currentIndex];
                if (targetCell && targetCell.hasAttribute('contenteditable')) {
                    targetCell.focus();
                    // Seleciona todo o conteúdo da célula
                    window.getSelection().selectAllChildren(targetCell);
                }
            }
        }
        // Verifica se é um input ou textarea em um formulário
        else if (activeElement.matches('input, textarea, select')) {
            const form = activeElement.closest('form');
            if (form) {
                const inputs = Array.from(form.querySelectorAll('input:not([type="radio"]), textarea, select'));
                const currentIndex = inputs.indexOf(activeElement);
                
                // Define o índice do próximo input baseado na direção
                const targetIndex = isShiftPressed ? currentIndex - 1 : currentIndex + 1;
                
                // Verifica se o índice alvo é válido
                if (targetIndex >= 0 && targetIndex < inputs.length) {
                    const targetInput = inputs[targetIndex];
                    targetInput.focus();
                    // Seleciona todo o conteúdo do input/textarea
                    targetInput.select();
                }
            }
        }
    }
}