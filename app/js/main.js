import {addProductRow, removeProductRow, addSupplierColumn, atualizarOuvintesTabCot, prenchTabCot} from './table_utils.js'
import {buscarFornecedores, buscarCentrosCusto, buscarClassesOperacionais} from './dados_p_selects.js';
import {customModal, executar_apiZoho} from './utils.js'
import {
    adicionarCampoVenc, 
    removerCampoVenc, 
    mostrarCamposPagamento,
    adicionarLinhaClassificacao, 
    removerLinhaClassificacao,
    initClassificacaoForm,
    preencherDadosPDC

} from './forms_utils.js';

const _nomeApp = "app-envio-de-notas-boletos-guillaumon";
const _nomeRelPDC = "Laranj_PDC_Digital_ADM";
const _nomeFormCot = "cotacao_Laranjeiras";
const _nomeRelCot = "Laranj_cotacoes_ADM";
const _nomeFormPDC = "PDC_Digital";

let _baseFornecedores = new Map();
let _baseClassesOperacionais = new Map();
let _baseCentrosCusto = new Map();


class Globais {
    constructor() {
        this.state = {
            baseClassesOperacionais: _baseClassesOperacionais,
            baseFornecedores: _baseFornecedores,
            baseCentrosCusto: _baseCentrosCusto,
            nomeFormCot: _nomeFormCot,
            nomeFormPDC: _nomeFormPDC,
            nomeRelCot: _nomeRelCot,
            nomeRelPDC: _nomeRelPDC,
            cotacaoExiste: false,
            pag: 'criar_cotacao',
            classificacoes: null,
            centrosCusto: null,
            numPDC_temp: null,
            nomeApp: _nomeApp,
            numPDC: null,
            idProduto: 2,
            idPDC: null,
            tipo: null
        }

        return new Proxy(this.state, {
            get: (target, prop) => {
                return prop in target ? target[prop] : undefined;
            },
            set: (target, prop, value) => {
                target[prop] = value;
                return true;
            }
        });
    }
}
export const globais = new Globais();

//===============================================================================================//
//====================ATIVA UM LISTENER QUE AGUARDA A ATUALIZAÇÃO DA PLANILHA====================//
//===============================================================================================//

/**
 * Adiciona event listeners quando o DOM é carregado
 * 
 * @description
 * Esta função:
 * - Define um mapeamento de classes de botões para suas funções correspondentes
 * - Adiciona event listeners para cada botão mapeado
 * - Executa processos iniciais necessários
 * - Adiciona pontos de navegação
 * 
 * Mapeamento de botões:
 * - add-supplier-btn: Adiciona coluna de fornecedor
 * - remove-supplier-btn: Remove fornecedor após confirmação
 * - add-product-btn: Adiciona linha de produto
 * - remove-product-btn: Remove produto após confirmação
 * - save-btn: Salva cotação após confirmação
 * - formas-pagamento: Mostra campos de pagamento relevantes
 * - add-parcela: Adiciona campo de parcela
 * - remover-parcela: Remove campo de parcela
 * - add-classificacao: Adiciona linha de classificação
 * - remover-classificacao: Remove linha de classificação
 */
document.addEventListener('DOMContentLoaded', () => {

   //=====Mapeia as classes dos botões às suas respectivas funções=====//
    const buttonActions = {
        "add-supplier-btn": () => addSupplierColumn(),
        "add-product-btn": () => addProductRow(),
        "remove-product-btn": (elemento) => customModal({botao: elemento, tipo: 'remover_produto', mensagem: 'Deseja realmente remover este produto?'}).then(()=> {removeProductRow(elemento)}),
        "save-btn": (elemento) => customModal({botao: elemento, mensagem: 'Deseja realmente salvar esta cotação?'}),
        "formas-pagamento": (elemento) => mostrarCamposPagamento(),
        "add-parcela": () => adicionarCampoVenc(),
        "remover-parcela": (elemento) => removerCampoVenc(elemento),
        "add-classificacao": () => adicionarLinhaClassificacao(),
        "remover-classificacao": (elemento) => removerLinhaClassificacao(elemento)
    };

    //=====Adiciona os event listeners para cada botão=====//
    Object.keys(buttonActions).forEach((className) => {
        const elementos = document.querySelectorAll(`.${className}`);
        elementos.forEach((elemento) => {
            elemento.addEventListener("click", () => {
                buttonActions[className](elemento);
            });
        });
    });

    //=====Busca todos os dados iniciais do PDC=====//
    executarProcessosInicias();
    addNavDots();
    
    console.log(`DOM Content Loaded`);
});

/**
 * Executa os processos iniciais necessários ao carregar a página
 * 
 * @function executarProcessosInicias
 * @async
 * @returns {Promise<void>}
 * 
 * @description
 * Esta função realiza as seguintes operações:
 * 1. Inicializa o ZOHO.CREATOR
 * 2. Busca e processa parâmetros da URL (idPdc, num_PDC_temp, pag)
 * 3. Busca dados do PDC se existir, usando os parâmetros obtidos
 * 4. Busca dados da cotação se existir
 * 5. Busca fornecedores
 * 6. Se a página for "aprovar_cotacao", substitui o botão Salvar por:
 *    - Botão Aprovar
 *    - Botão Solicitar Ajuste  
 *    - Botão Arquivar
 * 7. Atualiza os ouvintes da tabela de cotação
 */
async function executarProcessosInicias() {
    await ZOHO.CREATOR.init()
    //=================================================//
    //==========BUSCA OS PARÂMETROS DA PÁGINA==========//
    //=================================================//
    const params = await ZOHO.CREATOR.UTIL.getQueryParams()
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
    //===========================================//
    //==========BUSCA OS DADOS INICIAIS==========//
    //===========================================//

    //=====BUSCA OS DADOS PARA POPULAR OS SELECTS=====//
    try {
        let cPDC = "(" + (globais.numPDC ? `numero_de_PDC=="${globais.numPDC}"` : (globais.numPDC_temp ? `id_temp=="${globais.numPDC_temp}"` : "ID==0")) + ")";

        let respPDC = await executar_apiZoho({ tipo: "busc_reg", criterios: cPDC, nomeR: globais.nomeRelPDC })
        if (respPDC.code == 3000) {
            //PREENCHE A TABELA COM OS DADOS DO PDC//
            console.log("Tem PDC");
            globais.tipo = 'editar_pdc';
            console.log('TIPO => ', globais.tipo);
            preencherDadosPDC(respPDC);
    
        } else {
            //CRIA OS CAMPOS PARA PREENCHER DADOS DO PDC//
            console.log("Não tem PDC")
        }

         //=====BUSCA OS DADOS INICIAIS DO PDC, CASO EXISTAM=====//
        let cCot = "(" + (globais.numPDC ? `numero_de_PDC=="${globais.numPDC}"` : (globais.numPDC_temp ? `num_PDC_temp=="${globais.numPDC_temp}"` : "ID==0")) + ")";

        let respCot = await executar_apiZoho({ tipo: "busc_reg", criterios: cCot, nomeR: globais.nomeRelCot });
        if (respCot.code == 3000) {
            //PREENCHE A TABELA COM OS DADOS DO PDC//
            console.log("Tem Cotação");
            console.log(JSON.stringify(respCot));
            await prenchTabCot(respCot);

        } else {
            //CRIA OS CAMPOS PARA PREENCHER DADOS DO PDC
            console.log("Não tem Cotação")
        }




        globais.baseFornecedores = await buscarFornecedores();
        globais.baseCentrosCusto = await buscarCentrosCusto();
        globais.baseClassesOperacionais = await buscarClassesOperacionais();

        

        // Inicializa o formulário de classificação após carregar todos os dados
        initClassificacaoForm(globais.baseClassesOperacionais, globais.baseCentrosCusto);
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        // Opcional: mostrar mensagem de erro no formulário
        const loadingMessage = document.getElementById('loading-classificacao');
        loadingMessage.textContent = 'Erro ao carregar classificações. Por favor, recarregue a página.';
        loadingMessage.style.color = '#ff0000';
    }

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
                customModal({botao:this, tipo:"aprov_cot", titulo:"Aprovar proposta", mensagem:"Tem certeza que deseja APROVAR a proposta do fornecedor selecionado?"});
            };

            // Cria o botão "Solicitar Ajuste"
            const adjustButton = document.createElement('button');
            adjustButton.className = 'adjust-btn';
            adjustButton.textContent = 'Solicitar Ajuste';
            adjustButton.onclick = function () {
                customModal({botao:this, tipo:"ajustar_cot", titulo:"Solicitação de Ajuste", mensagem:"Por favor, descreva abaixo o ajuste que deseja fazer:"});
            };

            // Cria o botão "Arquivar"
            const archiveButton = document.createElement('button');
            archiveButton.className = 'archive-btn';
            archiveButton.textContent = 'Arquivar';
            archiveButton.onclick = function () {
                customModal({botao:this, tipo:"arquivar_cot", titulo:"Arquivar", mensagem:"Você tem certeza de que deseja arquivar este registro?"});
            };

            // Adiciona os novos botões ao contêiner
            saveBtnContainer.appendChild(approveButton);
            saveBtnContainer.appendChild(adjustButton);
            saveBtnContainer.appendChild(archiveButton);
        }

        // Chame a função para substituir o botão "Salvar" pelos novos botões
        replaceSaveButton();
    }
    atualizarOuvintesTabCot();
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