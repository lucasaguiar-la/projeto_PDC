import{formatToBRL, converterStringParaDecimal, convertToNegative,restrictNumericInput, restrictIntegerInput, executar_apiZoho, customModal} from './utils.js';
import{globais} from './main.js'
import { atualizarValorTotalClassificacoes, atualizarValorTotalParcelas } from './forms_utils.js';
let idsCotacao = new Array(); //Array para armazenar os ids das cotações
let selectedCheckbox = null; //Flag para seleção de fornecedor aprovado

const qlt = 4; //Total de linhas de totalizadores, considerando linha com botão de adicionar produto
const ipcv = 3; //Indice da primeira coluna de valores (Valor unitário do primeiro fornecedor)
const mpcv = ipcv%2 === 0? false: true; // Verifica se o indice da primeira coluna de valores é par ou impar, para definir o tipo de dados de cada célula criada

//====================================================================================================//
//===========================FUNÇÕES AUXILIARES PARA MANIPULAÇÃO DAS LINHAS===========================//
//====================================================================================================//
/**
 * Adiciona uma nova linha de produto na tab de cotação
 * 
 * @function addProductRow
 * @returns {void}
 * 
 * @description
 * Esta função:
 * - Insere uma nova linha na tab antes das linhas de totalizadores
 * - Configura um ID único para o novo produto
 * - Cria células editáveis para:
 *   - Descrição do produto (primeira coluna)
 *   - Quantidade (segunda coluna, apenas números inteiros)
 *   - Valores unitários (colunas pares, aceita decimais)
 * - Adiciona botão de remoção na última coluna
 * - Atualiza os listeners da tab
 */
export function addProductRow() {
    // Flag para verificar se a célula deve ser ímpar ou par

    // Obtém referência ao corpo da tab
    const table = document.getElementById('priceTable').getElementsByTagName('tbody')[0];
    
    // Insere nova linha antes dos totalizadores
    const newRow = table.insertRow(table.rows.length - qlt);
    newRow.dataset.id_produto = globais.idProduto;
    globais.idProduto = (globais.idProduto + 1);
    const rowCount = table.rows[0].cells.length;

    // Configura as células da nova linha
    for (let i = 0; i < rowCount; i++) {
        const newCell = newRow.insertCell(i);
        if (i === 0 || i === 2)  {
            // Coluna de descrição do produto
            newCell.contentEditable = "true";
        } else if (i === 1) {
            // Coluna de quantidade (apenas números inteiros)
            newCell.contentEditable = "true";
            newCell.classList.add('numeric-cell', 'integer-cell');
        } else if (i === rowCount - 1) {
            // Última coluna - botão de remoção
            const removeButton = document.createElement('button');
            removeButton.classList.add('remove-btn', 'remove-product-btn');

            removeButton.addEventListener('click', () => {
                customModal({
                    botao: removeButton, 
                    tipo: 'remover_produto', 
                    mensagem: 'Deseja realmente remover este produto?<br>Todos os valores deste produto serão removidos.'
                }).then((confirmacao)=>{
                    if (confirmacao===true) {
                        removeProductRow(removeButton);
                    }
                });
            });

            const icon = document.createElement('i');
            icon.classList.add('trash-icon', 'icons');
            removeButton.appendChild(icon);

            newCell.classList.add('action-buttons');
            newCell.appendChild(removeButton);
        }else if ((mpcv && i % 2 !== 0) || (!mpcv && i % 2 === 0) && i > ipcv) {
            // Colunas de valores unitários (aceita decimais)
            newCell.contentEditable = "true";
            newCell.classList.add('numeric-cell');
        } else {
            // Células de totais (não editáveis)
            newCell.innerText = "";
        }
    }

    // Atualiza os listeners da tab
    atualizarOuvintesTabCot();
}

/**
 * Remove a linha do produto selecionado da tab de cotação
 * 
 * @function removeRow
 * @param {HTMLElement} button - Botão de remoção que foi clicado
 * @returns {void}
 * 
 * @description
 * - Verifica se existe mais de uma linha na tab antes de remover
 * - Remove a linha do produto selecionado se houver mais de uma linha
 * - Exibe alerta se tentar remover a última linha da tab
 */
export function removeProductRow(button) {
    // Obtém referência ao corpo da tab de preços
    const table = document.getElementById('priceTable');
    const tbody = table.getElementsByTagName('tbody')[0];
    const corpoTab = Array.from(tbody.rows).slice(0, -qlt);

    // Verifica se há mais de uma linha antes de remover
    if (corpoTab.length > 1) {
        // Navega do botão até a linha (tr) e remove
        const row = button.parentNode.parentNode;
        row.parentNode.removeChild(row);
    } else {
        // Impede remoção da última linha
        return "Não é possível remover a última linha."
    }
    calcularTotais();
}

//====================================================================================================================//
//===========================FUNÇÕES AUXILIARES PARA MANIPULAÇÃO DAS COLUNAS (FORNECEDORES)===========================//
//====================================================================================================================//
/**
 * Adiciona um novo fornecedor à tab de cotação
 * 
 * @function addSupplierColumn
 * @returns {Promise<void>}
 * 
 * @description
 * Esta função:
 * 1. Cria um popup com interface para seleção de fornecedor:
 *    - Mostra spinner de carregamento inicial
 *    - Exibe dropdown com lista de fornecedores após carregar
 *    - Campo de pesquisa para filtrar fornecedores
 *    - Botão para fechar o popup
 * 
 * 2. Aguarda o carregamento dos dados dos fornecedores:
 *    - Verifica se globais.baseFornecedores está preenchido
 *    - Exibe mensagem de erro caso falhe o carregamento
 * 
 * 3. Permite interação do usuário:
 *    - Pesquisa dinâmica na lista de fornecedores
 *    - Seleção do fornecedor desejado
 *    - Fechamento do popup
 * 
 * @throws {Error} Erro ao carregar dados dos fornecedores
 */
export async function addSupplierColumn() {
    // Configurações iniciais
    const qtdCaract = 20; // Limite de caracteres para o nome do fornecedor
    const tab = document.getElementById('priceTable');
    const cabecalhoLinha1 = tab.rows[0];
    const cabecalhoLinha2 = tab.rows[1];

    //==========Criação do Container Inicial==========//
    const containerFornecedor = document.createElement('div');
    containerFornecedor.classList.add('container-fornecedor');
    containerFornecedor.style.position = 'relative';

    // Estado inicial de carregamento com spinner
    const loadingState = document.createElement('div');
    loadingState.classList.add('loading-state');
    
    const spinner = document.createElement('div');
    spinner.classList.add('loading-spinner');
    
    const loadingText = document.createElement('div');
    loadingText.classList.add('loading-text');
    loadingText.innerText = 'Carregando fornecedores...';
    
    loadingState.appendChild(spinner);
    loadingState.appendChild(loadingText);

    // Criar e mostrar o popup inicial
    const overlay = document.createElement('div');
    overlay.classList.add('popup-overlay');
    const popupFornecedor = criarPopupBase(loadingState); // Inicialmente mostra o estado de carregamento
    overlay.appendChild(popupFornecedor);
    document.body.appendChild(overlay);

    try {
        await new Promise((resolve) => {
            const checkBase = () => {
                if (globais.baseFornecedores && globais.baseFornecedores.size > 0) {
                    resolve();
                } else {
                    setTimeout(checkBase, 100);
                }
            };
            checkBase();
        });

        // Após carregar, substitui o conteúdo do popup
        const conteudoPopup = popupFornecedor.querySelector('.popup-content');
        conteudoPopup.innerHTML = ''; // Limpa o conteúdo de carregamento

        // Cria o dropdown após carregar
        const botaoAbrirDropdown = document.createElement('button');
        botaoAbrirDropdown.classList.add('dropdown-btn');
        botaoAbrirDropdown.innerText = 'Selecione um fornecedor...';

        const listaDropdown = document.createElement('div');
        listaDropdown.classList.add('dropdown-content');

        const campoPesquisa = document.createElement('input');
        campoPesquisa.type = 'text';
        campoPesquisa.placeholder = 'Pesquisar fornecedor...';
        campoPesquisa.classList.add('campo-pesquisa-fornecedor');
        listaDropdown.appendChild(campoPesquisa);

        const containerOpcoes = document.createElement('div');
        containerOpcoes.classList.add('opcoes-container');

        // Popula o dropdown com os fornecedores
        globais.baseFornecedores.forEach((dadosFornecedor, idFornecedor) => {
            const opcao = document.createElement('div');
            opcao.classList.add('dropdown-opcao');
            
            opcao.dataset.fornecedor = dadosFornecedor[0]; // Número do fornecedor como dataset
            let nomeFornecedor = dadosFornecedor[1];
            if (nomeFornecedor.length > qtdCaract) {
                nomeFornecedor = nomeFornecedor.substring(0, qtdCaract) + '...';
            }
            opcao.innerText = `${nomeFornecedor} - ${dadosFornecedor[2]}`; // Nome - CNPJ
            opcao.title = dadosFornecedor[1];
            
            opcao.onclick = () => {
                const nomeCompletoFornecedor = opcao.title;
                const nome_forn = nomeCompletoFornecedor.substring(0, qtdCaract) + '...';
    
                //==========Criação das Colunas do Fornecedor==========//
                const celulaCabecalho = document.createElement('th');
                celulaCabecalho.colSpan = 2;
                celulaCabecalho.dataset.id_forn = dadosFornecedor[0];
                celulaCabecalho.title = `${nomeCompletoFornecedor} - ${dadosFornecedor[2]}`;
                
                const nomeFornText = document.createElement('div');
                nomeFornText.innerText = nome_forn;
    
                // Botão de remoção do fornecedor
                const removeButton = document.createElement('button');
                removeButton.classList.add('remove-btn', 'remove-forn-btn', 'close-icon');
                removeButton.addEventListener('click', () => {
                    customModal({
                        botao: removeButton, 
                        tipo: 'remover_fornecedor',
                        mensagem: `Deseja realmente remover o fornecedor <b>${nomeCompletoFornecedor}</b>?<br>Todos os valores deste fornecedor serão removidos.`
                    }).then((confirmacao)=>{
                        if (confirmacao===true) {
                            removeSupplierColumn(removeButton);
                        }
                    });
                });

                // Checkbox de seleção do fornecedor
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.classList.add('supplier-checkbox');
                checkbox.addEventListener('change', function () {
                    // Obtém as linhas de cabeçalho diretamente
                    const headerRow1 = checkbox.closest('table').querySelector('thead tr:nth-child(1)');
                    const headerRow2 = checkbox.closest('table').querySelector('thead tr:nth-child(2)');

                    // Remove a classe 'forn-aprovado' de todas as células de cabeçalho
                    const allHeaderCells = headerRow1.querySelectorAll('th, td'); // Seleciona todas as células do cabeçalho
                    allHeaderCells.forEach(cell => {
                        cell.classList.remove('forn-aprovado'); // Remove a classe de todas as células
                    });

                    // Remove a classe 'forn-aprovado' de todas as células de cabeçalho
                    const allHeaderCells2 = headerRow2.querySelectorAll('th, td'); // Seleciona todas as células do cabeçalho
                    allHeaderCells2.forEach(cell => {
                        cell.classList.remove('forn-aprovado'); // Remove a classe de todas as células
                    });

                    if (checkbox.checked) {
                        if (selectedCheckbox && selectedCheckbox !== checkbox) {
                            selectedCheckbox.checked = false;
                        }
                        selectedCheckbox = checkbox;
                        globais.idFornAprovado = dadosFornecedor[0];

                        // Adiciona a classe 'forn-aprovado' às células do fornecedor selecionado
                        const headerCell = checkbox.closest('th'); // Célula do cabeçalho correspondente
                        headerCell.classList.add('forn-aprovado'); // Adiciona a classe ao cabeçalho do fornecedor

                        // Adiciona a classe 'forn-aprovado' às células de valor unitário e total
                        const colIndex = Array.from(headerRow1.cells).indexOf(headerCell); // Índice da célula do cabeçalho
                        const unitPriceHeader = headerRow2.cells[colIndex * 2 - ipcv]; // Célula de valor unitário
                        const totalPriceHeader = headerRow2.cells[colIndex * 2 - (ipcv - 1)]; // Célula de valor total
                        unitPriceHeader.classList.add('forn-aprovado'); // Adiciona a classe ao valor unitário
                        totalPriceHeader.classList.add('forn-aprovado'); // Adiciona a classe ao valor total
                    
                    } else {
                        selectedCheckbox = null;
                        globais.idFornAprovado = null;
                    }
                    atualizarValorTotalParcelas();
                    atualizarValorTotalClassificacoes();
                });
    
                // Montagem do container do fornecedor
                const container = document.createElement('div');
                container.classList.add('container-fornecedor');
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'space-between';
                container.style.gap = '5px';
    
                container.appendChild(checkbox);
                container.appendChild(nomeFornText);
                container.appendChild(removeButton);
                celulaCabecalho.appendChild(container);
                celulaCabecalho.style.position = 'relative';
    
                // Inserção das colunas no cabeçalho
                cabecalhoLinha1.insertBefore(celulaCabecalho, cabecalhoLinha1.cells[cabecalhoLinha1.cells.length -1]);
    
                const celulaPrecoUnitario = document.createElement('th');
                celulaPrecoUnitario.innerText = 'Valor Unitário';
                cabecalhoLinha2.insertBefore(celulaPrecoUnitario, cabecalhoLinha2.cells[cabecalhoLinha2.cells.length -1]);
    
                const celulaPrecoTotal = document.createElement('th');
                celulaPrecoTotal.innerText = 'Valor Total';
                cabecalhoLinha2.insertBefore(celulaPrecoTotal, cabecalhoLinha2.cells[cabecalhoLinha2.cells.length -1]);
    
                //==========Adição das Células nas Linhas==========//
                const linhas = tab.getElementsByTagName('tbody')[0].rows;
                for (let i = 0; i < linhas.length - 1; i++) {
                    if(i < linhas.length - qlt) {
                        // Células para produtos
                        const celulaPrecoUnitarioLinha = linhas[i].insertCell(linhas[i].cells.length - 1);
                        celulaPrecoUnitarioLinha.contentEditable = "true";
                        celulaPrecoUnitarioLinha.classList.add('numeric-cell');
    
                        const celulaPrecoTotalLinha = linhas[i].insertCell(linhas[i].cells.length - 1);
                        celulaPrecoTotalLinha.classList.add('numeric-cell');
                    } else {
                        // Células para totalizadores
                        const celulaTotalizadora = linhas[i].insertCell(linhas[i].cells.length - 1);
    
                        if(i >= (linhas.length-4) && i < (linhas.length-2)) {
                            celulaTotalizadora.contentEditable = "true";
                        } else if(i == (linhas.length-2)) {
                            celulaTotalizadora.classList.add("total-fornecedor");
                            celulaTotalizadora.contentEditable = "false";
                        }
                        celulaTotalizadora.classList.add('numeric-cell');
                        celulaTotalizadora.colSpan = 2;
                    }
                }
    
                //==========Atualização da tab de Dados Adicionais==========//
                const otherTableBody = document.getElementById('otherDataTable').getElementsByTagName('tbody')[0];
                
                if (otherTableBody.rows.length === 1 && !otherTableBody.rows[0].cells[0].textContent.trim()) {
                    otherTableBody.deleteRow(0);
                }
                
                const newRow = otherTableBody.insertRow();
                const fornecedorCell = newRow.insertCell(0);
                fornecedorCell.innerText = nome_forn;
                fornecedorCell.dataset.id_forn = idFornecedor;
    
                const condicoesPagamentoCell = newRow.insertCell(1);
                const observacoesCell = newRow.insertCell(2);
    
                [condicoesPagamentoCell, observacoesCell].forEach(cell => {
                    cell.contentEditable = "true";
                    cell.classList.add('editable-cell');
                });
    
                document.body.removeChild(overlay);
                atualizarOuvintesTabCot();
            };
            
            containerOpcoes.appendChild(opcao);
        });

        listaDropdown.appendChild(containerOpcoes);
        containerFornecedor.appendChild(botaoAbrirDropdown);
        containerFornecedor.appendChild(listaDropdown);

        // Adiciona o containerFornecedor ao conteúdo do popup
        conteudoPopup.appendChild(containerFornecedor);

        // Adiciona os eventos do dropdown
        botaoAbrirDropdown.onclick = () => {
            listaDropdown.classList.toggle('show');
            listaDropdown.style.display = listaDropdown.style.display === 'block' ? 'none' : 'block';
            campoPesquisa.focus();
        };

        // Adiciona o evento de pesquisa
        campoPesquisa.addEventListener('input', () => {
            const filtro = campoPesquisa.value.toLowerCase();
            const opcoes = containerOpcoes.getElementsByClassName('dropdown-opcao');
            for (let i = 0; i < opcoes.length; i++) {
                const opcao = opcoes[i];
                const texto = opcao.innerText.toLowerCase();
                opcao.style.display = texto.includes(filtro) ? '' : 'none';
            }
        });

    } catch (error) {
        console.error('Erro ao carregar fornecedores:', error);
        const conteudoPopup = popupFornecedor.querySelector('.popup-content');
        loadingText.innerText = 'Erro ao carregar fornecedores';
        loadingText.style.color = '#dc3545';
        spinner.style.display = 'none';
    }
}

/**
 * Remove as colunas de um fornecedor selecionado da tab de cotação
 * 
 * @function removeSupplierColumn
 * @param {HTMLElement} button - Botão de remoção que foi clicado
 * @returns {void}
 * 
 * @description
 * - Remove as colunas relacionadas ao fornecedor selecionado da tab principal (valor unitário e total)
 * - Remove a célula mesclada do fornecedor no cabeçalho
 * - Remove as células de totalizadores para o fornecedor
 * - Remove a linha correspondente na tab de dados adicionais
 * - Mantém a estrutura e formatação da tab
 * - Usa o ID do fornecedor armazenado no dataset para garantir remoção correta
 */
export function removeSupplierColumn(button) {
    const table = document.getElementById('priceTable');
    const headerRow1 = table.rows[0];
    const headerRow2 = table.rows[1];
    const tbody = table.getElementsByTagName('tbody')[0];

    // Encontra a célula do cabeçalho e índices
    const headerCell = button.closest('th');
    const colIndex = Array.from(headerRow1.cells).indexOf(headerCell);
    const supplierId = headerCell.dataset.id_forn;

    // Função auxiliar para remover célula com verificação de índice válido
    const safeDeleteCell = (row, index) => {
        if (index >= 0 && index < row.cells.length) {
            row.deleteCell(index);
        }
    };

    // Remove células do corpo da tab
    const rows = tbody.rows;
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        
        if (i < rows.length - qlt) {
            // Remove células de produtos (2 colunas por fornecedor)
            const baseIndex = colIndex * 2 - ipcv;
            safeDeleteCell(row, baseIndex); // Valor unitário
            safeDeleteCell(row, baseIndex); // Valor total
        } else {
            // Remove células de totalizadores (células mescladas)
            safeDeleteCell(row, colIndex - 1);
        }
    }

    // Remove células do cabeçalho
    if (colIndex + 1 < headerRow2.cells.length) {
        const headerBaseIndex = colIndex * 2 - 2;
        safeDeleteCell(headerRow2, headerBaseIndex); // Valor Total
        safeDeleteCell(headerRow2, headerBaseIndex); // Valor Unitário
    }
    safeDeleteCell(headerRow1, colIndex); // Célula mesclada do fornecedor

    // Remove linha correspondente na tab de dados adicionais
    const otherTable = document.getElementById('otherDataTable');
    const otherRows = otherTable.getElementsByTagName('tbody')[0].rows;
    
    for (let i = 0; i < otherRows.length; i++) {
        const fornecedorCell = otherRows[i].cells[0];
        if (fornecedorCell?.dataset.id_forn === supplierId) {
            otherTable.getElementsByTagName('tbody')[0].deleteRow(i);
            break;
        }
    }
}

/**
 * Cria a estrutura base de um popup para seleção de fornecedor
 * 
 * @function criarPopupBase
 * @param {HTMLElement} conteudo - Elemento HTML que será inserido como conteúdo do popup
 * @returns {HTMLElement} Elemento div contendo a estrutura completa do popup
 * 
 * @description
 * Esta função:
 * - Cria um container principal para o popup
 * - Adiciona um botão de fechar no topo
 * - Cria uma área para o conteúdo
 * - Adiciona um cabeçalho com título
 * - Insere o conteúdo fornecido
 * - Monta a estrutura hierárquica dos elementos
 * - Configura o evento de fechar o popup
 */
function criarPopupBase(conteudo) {
    const popupFornecedor = document.createElement('div');
    popupFornecedor.classList.add('popup-fornecedor');

    const botaoFechar = document.createElement('button');
    botaoFechar.classList.add('btn-fechar', 'close-icon');
    botaoFechar.onclick = () => document.body.removeChild(botaoFechar.closest('.popup-overlay'));

    const conteudoPopup = document.createElement('div');
    conteudoPopup.classList.add('popup-content');

    const cabecalhoPopup = document.createElement('div');
    cabecalhoPopup.classList.add('cabecalho-popup');
    cabecalhoPopup.innerText = 'Selecione um fornecedor';

    conteudoPopup.appendChild(cabecalhoPopup);
    conteudoPopup.appendChild(conteudo);

    popupFornecedor.appendChild(botaoFechar);
    popupFornecedor.appendChild(conteudoPopup);

    return popupFornecedor;
}

//=================================================================================================//
//===========================FUNÇÕES AUXILIARES PARA CALCULOS DE VALORES===========================//
//=================================================================================================//

/**
 * Calcula o valor total de cada uma das linhas de produto
 * 
 * @function calculateTotalPrices
 * @param {number} rowIndex - Índice da linha de produto
 * @returns {void}
 * 
 * @description
 * - Calcula o valor total de cada item na linha de produto
 * - Multiplica a quantidade pelo valor unitário para obter o valor total
 * - Formata o valor total em BRL e exibe na célula correspondente
 */
export function calculateTotalPrices(rowIndex) {
    const table = document.getElementById('priceTable').getElementsByTagName('tbody')[0];
    const row = table.rows[rowIndex];
    const quantityCell = row.cells[1]; //Quantidade do item
    const quantity = converterStringParaDecimal(quantityCell.innerText); //Converte a quantidade para um número decimal

    for (let i = ipcv; i < row.cells.length; i += 2) {
        const unitPriceCell = row.cells[i]; //Valor unitário do item
        const totalPriceCell = row.cells[i + 1]; //Valor total do item

        if (unitPriceCell && totalPriceCell) {
            const unitPrice = converterStringParaDecimal(unitPriceCell.innerText); //Converte o valor unitário para um número decimal
            totalPriceCell.innerText = formatToBRL((quantity * unitPrice)); //Calcula o valor total e formata para o padrão brasileiro
        }
    }
}

/**
 * Calcula o valor total para cada fornecedor na tab de cotação
 * 
 * @function calcularTotais
 * @returns {void}
 * 
 * @description
 * - Seleciona todas as células de "Valor Total" dos fornecedores na linha de totais
 * - Para cada fornecedor:
 *   - Soma os valores totais de todos os produtos
 *   - Adiciona o valor do frete
 *   - Adiciona o valor do desconto
 *   - Formata e exibe o total calculado em BRL
 */
function calcularTotais() {
    // Seleciona todas as células de "Valor Total" dos fornecedores na linha de totais (linha N+2)
    const table = document.getElementById('priceTable').getElementsByTagName('tbody')[0];
    const totalCells = table.querySelectorAll('.total-fornecedor');

    totalCells.forEach((totalCell, index) => {
        let vt = 0; //Valor total
        const vlrsFrete = (converterStringParaDecimal(table.rows[table.rows.length - qlt].cells[index + 1].textContent) || 0);
        const vlrsDesconto = (converterStringParaDecimal(table.rows[table.rows.length - (qlt - 1)].cells[index + 1].textContent) || 0);
        for (let i = 0; i < table.rows.length - qlt; i++)
        {
            const ci = ipcv + 1; //Coluna inicial da busca | indice da coluna inicial + 1 (Indice começa com zero)
            const linha = table.rows[i];

            const valorTotalCell = linha.cells[(index * 2) + ci];
            vt += (converterStringParaDecimal(valorTotalCell.textContent || '0') || 0);
        }
        const valorTotal = (vt + vlrsFrete + vlrsDesconto).toFixed(2);
        totalCell.textContent = formatToBRL(valorTotal);
    });
}

//====================================================================================================//
//===========================FUNÇÕES AUXILIARES PARA MANIPULAÇÃO DE COLAGEM===========================//
//====================================================================================================//

/**
 * Manipula o evento de colar (paste) na tab de preços
 * Permite colar dados de planilhas externas na tab de cotação, mantendo a formataão e cálculos
 * 
 * @function handlePasteEventPriceTable
 * @param {Event} event - Evento de colar (paste)
 * @returns {void}
 * 
 * @description
 * - Previne o comportamento padrão do evento paste
 * - Obtém os dados da área de transferência
 * - Identifica a célula inicial onde os dados serão colados
 * - Divide os dados em linhas e colunas
 * - Adiciona novas linhas de produto se necessário
 * - Cola os dados nas células correspondentes
 * - Recalcula os totais das linhas e da tab
 */
export function handlePasteEventPriceTable(event) {
    event.preventDefault();

    const clipboardData = event.clipboardData || window.clipboardData;
    const pastedData = clipboardData.getData('Text').trim();

    const table = document.getElementById('priceTable').getElementsByTagName('tbody')[0];
    const rows = table.rows;
    const startRowIndex = Array.prototype.indexOf.call(rows, event.target.parentNode);
    const startCellIndex = Array.prototype.indexOf.call(event.target.parentNode.cells, event.target);

    const pastedRows = pastedData.split('\n').map(row => row.split('\t'));

    for (let rowIndex = 0; rowIndex < pastedRows.length; rowIndex++) {
        if (startRowIndex + rowIndex >= rows.length) {
            addProductRow();
        }

        const cells = rows[startRowIndex + rowIndex].cells;

        for (let cellIndex = 0; cellIndex < pastedRows[rowIndex].length; cellIndex++) {
            if (startCellIndex + cellIndex >= cells.length) {
                continue;
            }

            const cell = cells[startCellIndex + cellIndex];
            let value = pastedRows[rowIndex][cellIndex];

            // Converte para formato apropriado baseado na classe da célula
            if(cell.classList.contains('integer-cell')) {
                value = parseInt(value);
            }
            else if (cell.classList.contains('numeric-cell')) {
                value = formatToBRL(value);
            }

            cell.innerText = value;
        }

        calculateTotalPrices(startRowIndex + rowIndex);
    }
    calcularTotais();
}

/**
 * Manipula o evento de colar (paste) na tab de detalhes dos fornecedores
 * Permite colar dados de planilhas externas nos campos de frete, condições de pagamento e observações
 * 
 * @function handlePasteEventDetailtable
 * @param {Event} event - Evento de colar (paste)
 * @returns {void}
 * 
 * @description
 * - Previne o comportamento padrão do evento paste
 * - Obtém os dados da área de transferência
 * - Divide os dados em linhas e colunas
 * - Cola os dados nas células correspondentes
 */
export function handlePasteEventDetailtable(event) {
    event.preventDefault();
    
    const clipboardData = event.clipboardData || window.clipboardData;
    const pasteData = clipboardData.getData('text');
    const table = document.getElementById('otherDataTable');
    const rows = pasteData.split('\n');

    for (let i = 0; i < rows.length; i++) {
        const dataRow = rows[i].split('\t');
        const tableRow = table.rows[i + 1];

        if (!tableRow) continue;

        for (let j = 1; j < tableRow.cells.length; j++) {
            const cell = tableRow.cells[j];
            const inputValue = dataRow[j - 1] || '';

            if (cell.querySelector('input')) {
                cell.querySelector('input').value = inputValue;
            } else {
                cell.innerText = inputValue;
            }
        }
    }
}

//=====================================================================================================//
//===========================FUNÇÕES AUXILIARES PARA MANIPULAÇÃO DE OUVINTES===========================//
//=====================================================================================================//

/**
 * Atualiza os listeners da tab de cotação
 * Remove todos os listeners existentes e adiciona novamente para garantir funcionamento correto
 * 
 * @function atualizarOuvintesTabCot
 * @returns {void}
 * 
 * @description
 * - Remove todos os listeners existentes
 * - Adiciona novamente os listeners necessários para garantir o funcionamento correto
 */
export function atualizarOuvintesTabCot() {
    const tab = document.getElementById('priceTable').getElementsByTagName('tbody')[0];
    const lv = tab.rows;

    if (!tab) return;

    // Remove listeners existentes
    function removeAllListeners(element) {
        const clone = element.cloneNode(true);
        element.parentNode.replaceChild(clone, element);
        return clone;
    }

    for (let i = 0; i < lv.length - 1; i++) {
        const c = lv[i].cells;
        for (let j = 0; j < c.length-1; j++) {
            removeAllListeners(c[j]);
        }
    }

    // Adiciona listeners para células numéricas
    tab.querySelectorAll('.numeric-cell').forEach(celula => {
        celula.addEventListener('input', () => restrictNumericInput(celula));
    });

    // Adiciona listener para converter valores negativos na antepenúltima linha
    const atpl = tab.rows[tab.rows.length - (qlt - 1)];
    for (let i = 0; i < atpl.cells.length; i++) {
        const celula = atpl.cells[i];
        celula.addEventListener('blur', () => {
            const valor = converterStringParaDecimal(celula.innerText);
            if (!isNaN(valor)) {
                celula.innerText = convertToNegative(valor);
            }
        }, {capture: true});
    }

    // Adiciona listeners para células da tab principal
    for (let i = 0; i < lv.length - 1; i++) {
        const linha = lv[i];
        const isTotalizador = i >= (lv.length - qlt);
        
        // Adiciona listeners específicos para cada coluna
        for (let j = 0; j < linha.cells.length - 1; j++) {
            const celula = linha.cells[j];
            
            // Adiciona paste event para todas as células
            celula.addEventListener('paste', (event) => handlePasteEventPriceTable(event));
            
            if (isTotalizador) {

                // Tratamento específico para linhas de totalizadores
                if (j > 0) { // Células após a célula com título da linha
                    celula.addEventListener('blur', () => {
                        formatToBRL(celula);
                        calcularTotais();
                    });
                }
            } else {
                // Tratamento para linhas normais de produtos
                if (j === 1) { // Coluna de quantidade
                    celula.addEventListener('blur', () => {
                        formatToBRL(celula);
                        calculateTotalPrices(i);
                    });
                } else if (j === 2) { // Coluna de unidade - apenas texto
                    continue;
                } else if (j > 2) { // Colunas de valores após a unidade
                    celula.addEventListener('blur', () => {
                        formatToBRL(celula);
                        calculateTotalPrices(i);
                    });
                }
                
                // Adiciona cálculo de totais para todas as células exceto a unidade
                if (j !== 2) {
                    celula.addEventListener('blur', () => calcularTotais());
                }
            }
        }
    }
}

/**
 * Atualiza os ouvintes de eventos da tab de detalhes dos fornecedores.
 * Adiciona um ouvinte de evento 'paste' para cada linha da tab, exceto o cabeçalho.
 * Isso permite que os dados sejam colados corretamente na tab de detalhes.
 * 
 * @function atualizarOuvintesTabDetlhesForn
 * @returns {void}
 * 
 * @description
 * - Adiciona um ouvinte de evento 'paste' para cada linha da tab, exceto o cabeçalho
 * - Isso permite que os dados sejam colados corretamente na tab de detalhes
 */
export function atualizarOuvintesTabDetlhesForn()
{
    const table = document.getElementById('otherDataTable');
    const rows = table.rows;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        row.addEventListener('paste', handlePasteEventDetailtable);
    }
}

//====================================================================================//
//===========================PREENCHE A tab DE COTAÇÃOES===========================//
//====================================================================================//
/**
 * Preenche a tab de cotações com os dados recebidos da API
 * 
 * @async
 * @function prenchTabCot
 * @param {Object} resp - Resposta da API contendo os dados das cotaçes
 * @param {number} resp.code - Código de resposta da API
 * @param {Array} resp.data - Array com os dados das cotações
 * @returns {void}
 * 
 * @description
 * Esta função:
 * - Verifica se existem dados válidos na resposta
 * - Remove a linha inicial da tab se existir
 * - Processa os dados para extrair:
 *   - IDs dos produtos
 *   - Lista de fornecedores
 *   - Valores de frete
 *   - Status de aprovação
 *   - Valores de desconto
 * - Para cada produto:
 *   - Cria uma nova linha na tab
 *   - Preenche nome e quantidade
 *   - Para cada fornecedor:
 *     - Adiciona colunas de valor unitário e total
 *   - Adiciona botão para remover o produto
 * - Adiciona cabeçalhos dos fornecedores com:
 *   - Checkbox de aprovação
 *   - Nome do fornecedor
 *   - Botão para remover fornecedor
 * - Preenche linhas de totalizadores:
 *   - Frete
 *   - Descontos  
 *   - Total por fornecedor
 * - Preenche tab de detalhes com:
 *   - Condições de pagamento
 *   - Observações
 */
export async function prenchTabCot(resp) {
    if (resp && resp.code === 3000 && Array.isArray(resp.data) && resp.data.length > 0) {
        console.log(JSON.stringify(resp));

        globais.cotacaoExiste = true;
        const table = document.getElementById('priceTable').getElementsByTagName('tbody')[0];
        const linhaInicial = document.getElementById('linha-inicial');
        if (linhaInicial) {
            linhaInicial.remove();
        }

        //=====Preparando dados da cotação (Fornecedores, produtos, valores e etc...)=====//
        const data = resp.data;

        const idProdutos = [...new Set(data.map(item => item.id_produto))].sort((a, b) => a - b);
        globais.idProduto = Math.max(...idProdutos) + 1;

        const fornecedores = [...new Set(data.map(item => JSON.stringify({ 
            Fornecedor: item.Fornecedor.trim(), 
            id_fornecedor: item.id_fornecedor 
        })))].map(item => JSON.parse(item));

        const valoresAprovado = data.map(item => item.Aprovado);
        const valoresFrete = [];
        const valoresDescontos = [];

        data.forEach(item => {
            const frete = item.Valor_do_frete;
            const desconto = item.Descontos;

            // Adiciona o frete ao array
            valoresFrete.push(frete);

            // Adiciona o desconto ao array
            valoresDescontos.push(desconto);
        });

        idsCotacao = [...new Set(data.map(item => item.ID))].sort((a, b) => a - b);
        
        //=====Cria linhas dos produtos=====//
        idProdutos.forEach((idProduto, index) => {
            //Busca dados do produto atual//
            let objProduto = data.filter(item => item.id_produto === idProduto);

            //Cria linha do produto//
            const newRow = table.insertRow(index);
            newRow.dataset.id_produto = objProduto[0].id_produto;  // Preencher o dataset com o ID do produto

            //NOME//
            const produtoCell = newRow.insertCell(0);
            produtoCell.classList.add('product-cell');
            produtoCell.innerText = objProduto[0].Produto || '';
            produtoCell.contentEditable = 'true';

            //QUANTIDADE//
            const quantidadeCell = newRow.insertCell(1);
            quantidadeCell.classList.add('numeric-cell', 'integer-cell');
            quantidadeCell.innerText = objProduto[0].Quantidade || '';
            quantidadeCell.contentEditable = 'true';
            quantidadeCell.addEventListener('input', restrictIntegerInput);

            //UNIDADE//
            const unidadeCell = newRow.insertCell(2);
            unidadeCell.innerText = objProduto[0].Unidade || '';
            unidadeCell.contentEditable = 'true';

            //Insere as colunas dos fornecedores na ordem correta
            fornecedores.forEach((fornecedorObj, fornecedorIndex) => {
                //VALOR UNITÁRIO//
                const valorUnitarioCell = newRow.insertCell(fornecedorIndex * 2 + ipcv);
                valorUnitarioCell.classList.add('numeric-cell');
                valorUnitarioCell.contentEditable = "true";

                //VALOR TOTAL//
                const valorTotalCell = newRow.insertCell(fornecedorIndex * 2 + (ipcv + 1));
                valorTotalCell.classList.add('numeric-cell');
                
                //Busca dados do fornecedor atual//
                const valoresFornProd = objProduto.filter(item => item.Fornecedor === fornecedorObj.Fornecedor);
                //Preenche os valores
                if (valoresFornProd.length > 0) {
                    valorUnitarioCell.innerText = formatToBRL(valoresFornProd[0].Valor_unitario || '');
                    valorTotalCell.innerText = formatToBRL(valoresFornProd[0].Valor_total || '');
                }
            });

            //Cria os botões de excluir as linhas de produto//
            if(fornecedores.length > 0) {
                // Cria a nova célula na linha//
                const cell = newRow.insertCell(fornecedores.length * 2 + ipcv);
                
                // Cria o botão//
                const removeButton = document.createElement('button');
                removeButton.classList.add('remove-btn', 'remove-product-btn');

                // Adiciona o evento de clique ao botão//
                removeButton.addEventListener('click', () => {
                    customModal({
                        botao: removeButton, 
                        tipo: 'remover_produto', 
                        mensagem: 'Deseja realmente remover este produto?<br>Todos os valores deste produto serão removidos.'});
                });

                // Cria o ícone dentro do botão//
                const icon = document.createElement('i');
                icon.classList.add('trash-icon', 'icons');

                // Anexa o ícone ao botão//
                removeButton.appendChild(icon);

                // Anexa o botão à célula//
                cell.appendChild(removeButton);
            } else {
                // Cria a nova célula na linha
                const cell = newRow.insertCell(2);

                // Cria o botão
                const removeButton = document.createElement('button');
                removeButton.classList.add('remove-btn', 'remove-product-btn');
                // Adiciona o evento de clique ao botão
                removeButton.addEventListener('click', () => {
                    customModal({
                        botao: removeButton, 
                        tipo: 'remover_produto', 
                        mensagem: 'Deseja realmente remover este produto?<br>Todos os valores deste produto serão removidos.'});
                });

                // Cria o ícone dentro do botão
                const icon = document.createElement('i');
                icon.classList.add('trash-icon', 'icons');

                // Anexa o ícone ao botão
                removeButton.appendChild(icon);

                // Anexa o botão à célula
                cell.appendChild(removeButton);
            }
        });
        
        //Função para adicionar os cabeçalhos de fornecedores na ordem correta//
        function addHeaderForn(fornecedores) {
            //Busca as 2 primeiras linhas da tab (1 - Nome do fornecedor e 2 - Valor unitário e Valor total)//
            const headerRow1 = table.parentElement.querySelector('thead tr:nth-child(1)');
            const headerRow2 = table.parentElement.querySelector('thead tr:nth-child(2)');
            
            const linhaFrete = table.querySelector('#linha-frete');
            const linhaDescontos = table.querySelector('#linha-descontos');
            const linhaTotal = table.querySelector('#linha-valor-total');
            let foundChecked = false;
            fornecedores.forEach((fornecedorObj, index) => {
                //Cria a célula com o nome do fornecedor//
                const celulaCabecalho = document.createElement('th');
                const checkbox = document.createElement('input');
    
                checkbox.type = 'checkbox';
                checkbox.classList.add('supplier-checkbox');

                if (valoresAprovado[index] == 'true') {
                    if (!foundChecked) {
                        checkbox.checked = true;
                        selectedCheckbox = checkbox;
                        globais.idFornAprovado = fornecedorObj.id_fornecedor;
                        foundChecked = true;
                    }
                }

                checkbox.addEventListener('change', function () {
                    // Obtém as linhas de cabeçalho diretamente
                    const headerRow1 = checkbox.closest('table').querySelector('thead tr:nth-child(1)');
                    const headerRow2 = checkbox.closest('table').querySelector('thead tr:nth-child(2)');

                    // Remove a classe 'forn-aprovado' de todas as células de cabeçalho
                    const allHeaderCells = headerRow1.querySelectorAll('th, td'); // Seleciona todas as células do cabeçalho
                    allHeaderCells.forEach(cell => {
                        cell.classList.remove('forn-aprovado'); // Remove a classe de todas as células
                    });

                    // Remove a classe 'forn-aprovado' de todas as células de cabeçalho
                    const allHeaderCells2 = headerRow2.querySelectorAll('th, td'); // Seleciona todas as células do cabeçalho
                    allHeaderCells2.forEach(cell => {
                        cell.classList.remove('forn-aprovado'); // Remove a classe de todas as células
                    });

                    //
                    if (checkbox.checked) {
                        if (selectedCheckbox && selectedCheckbox !== checkbox) {
                            selectedCheckbox.checked = false;
                        }
                        selectedCheckbox = checkbox;
                        globais.idFornAprovado = fornecedorObj.id_fornecedor;
                        
                        // Adiciona a classe 'forn-aprovado' às células do fornecedor selecionado
                        const headerCell = checkbox.closest('th'); // Célula do cabeçalho correspondente
                        headerCell.classList.add('forn-aprovado'); // Adiciona a classe ao cabeçalho do fornecedor

                        // Adiciona a classe 'forn-aprovado' às células de valor unitário e total
                        const colIndex = Array.from(headerRow1.cells).indexOf(headerCell); // Índice da célula do cabeçalho
                        const unitPriceHeader = headerRow2.cells[colIndex * 2 - ipcv]; // Célula de valor unitário
                        const totalPriceHeader = headerRow2.cells[colIndex * 2 - (ipcv - 1)]; // Célula de valor total
                        unitPriceHeader.classList.add('forn-aprovado'); // Adiciona a classe ao valor unitário
                        totalPriceHeader.classList.add('forn-aprovado'); // Adiciona a classe ao valor total
                    
                    } else {
                        selectedCheckbox = null;
                        globais.idFornAprovado = null;
                    }
                    atualizarValorTotalParcelas();
                    atualizarValorTotalClassificacoes();
                    
                });

                celulaCabecalho.dataset.id_forn = fornecedorObj.id_fornecedor;
                celulaCabecalho.colSpan = 2;
                
                // Cria o botão de remover fornecedor//
                const removeButton = document.createElement('button');
                removeButton.classList.add('remove-btn', 'remove-forn-btn', 'close-icon');

                
                removeButton.addEventListener('click', () => {
                    customModal({
                        botao: removeButton, 
                        tipo: 'remover_fornecedor', 
                        mensagem: `Deseja realmente remover o fornecedor ${fornecedorObj.Fornecedor}?\nTodos os valores deste fornecedor serão removidos.`
                    });
                });
                
                // Cria um container para o nome do fornecedor//
                const container = document.createElement('div');
                container.classList.add('supplier-name-container');

                // Adiciona o nome do fornecedor centralizado//
                const fornecedorText = document.createElement('span');
                fornecedorText.innerText = fornecedorObj.Fornecedor;
                fornecedorText.style.margin = '0 auto'; // Centraliza o texto

                // Adiciona o texto ao container//
                container.appendChild(checkbox);
                container.appendChild(fornecedorText);
                container.appendChild(removeButton);
                celulaCabecalho.appendChild(container);
                celulaCabecalho.style.position = 'relative';

                headerRow1.insertBefore(celulaCabecalho, headerRow1.cells[headerRow1.cells.length -1]);

                const unitPriceHeader = document.createElement('th');
                unitPriceHeader.innerText = 'Valor Unitário';
                headerRow2.insertBefore(unitPriceHeader, headerRow2.cells[headerRow2.cells.length -1]);

                const totalPriceHeader = document.createElement('th');
                totalPriceHeader.innerText = 'Valor Total';
                headerRow2.insertBefore(totalPriceHeader, headerRow2.cells[headerRow2.cells.length -1]);

                //=====ADICIONA A CELULA DE FRETE=====//
                const cellFrete = document.createElement('td');
                console.log("valores frete => ", valoresFrete[index]);
                cellFrete.innerText = formatToBRL(valoresFrete[index] || '0,00');
                cellFrete.classList.add('numeric-cell');
                cellFrete.colSpan = 2;
                cellFrete.contentEditable = "true";
                cellFrete.style.margin = '0 auto';
                linhaFrete.insertBefore(cellFrete, linhaFrete.cells[linhaFrete.cells.length -1]);
                

                //=====ADICIONA A CELULA DE DESCONTO=====//
                const cellDescontos = document.createElement('td');
                cellDescontos.innerText = formatToBRL(valoresDescontos[index] || '0,00');
                cellDescontos.classList.add('numeric-cell');
                cellDescontos.addEventListener('blur', () => calcularTotais());
                cellDescontos.colSpan = 2;
                cellDescontos.contentEditable = "true";
                cellDescontos.style.margin = '0 auto';
                linhaDescontos.insertBefore(cellDescontos, linhaDescontos.cells[linhaDescontos.cells.length -1]);

                //=====ADICIONA A CELULA DE TOTAL===//
                const totalFornecedor = data
                    .filter(item => item.id_fornecedor === fornecedorObj.id_fornecedor)
                    .reduce((acc, item) => acc + (parseFloat(item.Valor_total) || 0), 0);
                
                const cellTotal = document.createElement('td');
                cellTotal.innerText = formatToBRL(totalFornecedor);
                cellTotal.classList.add('numeric-cell', "total-fornecedor");
                cellTotal.colSpan = 2;
                cellTotal.contentEditable = "true";
                cellTotal.style.margin = '0 auto';
                linhaTotal.insertBefore(cellTotal, linhaTotal.cells[linhaTotal.cells.length -1]);

                // Adiciona linha na tab de detalhes das propostas
                const otherTable = document.getElementById('otherDataTable');
                const tbodyOther = otherTable.getElementsByTagName('tbody')[0];

                if (tbodyOther.rows.length === 1 && 
                    !tbodyOther.rows[0].cells[0].textContent.trim() && 
                    !tbodyOther.rows[0].cells[1].textContent.trim() && 
                    !tbodyOther.rows[0].cells[2].textContent.trim()) {
                    tbodyOther.deleteRow(0);
                }

                const detailRow = tbodyOther.insertRow();

                const fornCell = detailRow.insertCell();
                fornCell.textContent = fornecedorObj.Fornecedor;

                const condPagCell = detailRow.insertCell();
                const dadosFornecedor = data.find(item => item.id_fornecedor === fornecedorObj.id_fornecedor);
                condPagCell.textContent = dadosFornecedor?.Condicoes_de_pagamento || '';

                const obsCell = detailRow.insertCell();
                obsCell.textContent = dadosFornecedor?.Observacoes || '';

                // Adiciona a classe 'forn-aprovado' se o fornecedor estiver aprovado
                if (valoresAprovado[index] == 'true') {
                    celulaCabecalho.classList.add('forn-aprovado');

                    // Adiciona a classe 'forn-aprovado' às células de valor unitário e total
                    unitPriceHeader.classList.add('forn-aprovado'); // Adiciona a classe ao valor unitário
                    totalPriceHeader.classList.add('forn-aprovado'); // Adiciona a classe ao valor total
                }
            });
        }
        // Adiciona os cabeçalhos dos fornecedores na ordem correta
        addHeaderForn(fornecedores);
        // Calcula os totais
        calcularTotais();
    }
}

//=========================================================================================//
//===========================FUNÇÕES AUXILIARES PARA SALVAR TUDO===========================//
//=========================================================================================//
/**
 * Busca os dados do PDC.
 * 
 * @function pegarDadosPDC
 * @returns {Object} Os dados do PDC.
 * 
 * @description
 * Esta função busca os dados iniciais e detalhes do PDC a partir de formulários e os organiza em um objeto.
 */
async function pegarDadosPDC(){

    //====================BUSCA OS DADOS INICIAIS DO PDC====================//
    const formDdsInicais = document.querySelector('#dados-PDC');
    const dadosIniciaisPdc = {};

    // Obter todos os elementos do formulário
    const elementos = formDdsInicais.elements;
    for (let elemento of elementos) {
        // Verifica se o campo tem um valor e se está visível (caso de campos ocultos)
        if (elemento.name && (elemento.type !== 'radio' || elemento.checked)) {
            dadosIniciaisPdc[elemento.name] = elemento.value;
        }
    }
    dadosIniciaisPdc["id_temp"] = globais.numPDC_temp;

    //====================BUSCA OS DADOS DETALHES DO PDC====================//
    const formDdsDetalhes = document.querySelector('#form-pagamento');

    // Obter todos os elementos do formulário
    const parcelas = document.querySelectorAll('.parcela');
    const vencimentos = [];
    parcelas.forEach(parcela => {
        const dataInput = parcela.querySelector('input[type="date"]');
        const valorInput = parcela.querySelector('input[name="Valor"]');
        const numPDC = parcela.querySelector('input[name="Num_PDC_parcela"]');

        const vencimentoObj = {};
        if (dataInput?.value) {
            const [ano, mes, dia] = dataInput.value.split('-');
            vencimentoObj["Vencimento_previsto"] = `${dia}/${mes}/${ano}`;
        }
        if (valorInput?.value) {
            vencimentoObj["Valor"] = converterStringParaDecimal(valorInput.value);
        }
        if (numPDC?.value) {
            vencimentoObj["Num_PDC_parcela"] = numPDC.value;
        }

        // Adiciona o objeto ao array apenas se tiver pelo menos uma propriedade
        if (Object.keys(vencimentoObj).length > 0) {
            vencimentos.push(vencimentoObj);
        }
    });

    // Adiciona outros campos do formulário
    const elementosDetalhes = formDdsDetalhes.elements;
    for (let elemento of elementosDetalhes) {

        if (elemento.classList.contains("campo-datas") &&
            (elemento.type !== 'radio' || elemento.checked)) {
            dadosIniciaisPdc[elemento.name] = elemento.value;
        }
    }

    // Adiciona as parcelas ao objeto final
    if (vencimentos.length > 0) {
        dadosIniciaisPdc["Datas"] = vencimentos;
        // Adiciona o primeiro vencimento em um campo separado para referência
        if (vencimentos[0].Vencimento_previsto) {
            dadosIniciaisPdc["Vencimento_previsto"] = vencimentos[0].Vencimento_previsto;
        }
        if (vencimentos[0].Num_PDC_parcela) {
            dadosIniciaisPdc["Numero_do_PDC"] = vencimentos[0].Num_PDC_parcela.split('/')[0];
        }
    }

    return dadosIniciaisPdc;
}

/**
 * Busca os dados da tab de preços.
 * 
 * @function pegarDadostabPrecos
 * @returns {Object} Os dados da tab de preços e dados extras do PDC.
 * 
 * @description
 * Esta função busca os dados da tab de preços, incluindo os fornecedores, valores unitários, totais, frete, descontos e outros detalhes.
 */
async function pegarDadostabPrecos(){
     //====================BUSCA OS DADOS DA TAB DE PREÇOS====================//
     const tab = document.getElementById('priceTable');
     const cabecalho1 = tab.rows[0];
     const linhaFrete = tab.rows[tab.rows.length - qlt];
     const linhaDescontos = tab.rows[tab.rows.length -(qlt-1)];
     const linhaTotal = tab.rows[tab.rows.length -(qlt-2)];

     const corpoTab = tab.getElementsByTagName('tbody')[0].rows;
     const dadosExtrasPDC = {};
     const dados = [];

     // Variáveis da segunda tab (Detalhes das Cotações)
     const tabDetalhes = document.getElementById('otherDataTable');
     const linhasDetalhes = tabDetalhes.getElementsByTagName('tbody')[0].rows;

     const fornecedores = [];
     const custosFrete = [];
     const descontos = [];
     const totalGeral = [];
     const idsFornecedores = [];


     // Captura os fornecedores da tab
     for (let i = 0; i < cabecalho1.cells.length; i++) {

         if (cabecalho1.cells[i].colSpan > 1) {
             const nomeFornecedor = cabecalho1.cells[i].innerText.trim().replace(/ \u00d7$/, '');
             const idFornecedor = cabecalho1.cells[i].dataset.id_forn;
             idsFornecedores.push(idFornecedor);
             fornecedores.push(nomeFornecedor);

             const frete = converterStringParaDecimal((linhaFrete.cells[i - (ipcv - 1)].innerText) || '0');//É -1 PORQUE BUSCA O INDICE DA ULTIMA LINHA DE APOIO E NÃO DA PRIMEIRA LINHA DE VALORES
             custosFrete.push(frete);

             const desconto = converterStringParaDecimal((linhaDescontos.cells[i - (ipcv - 1)].innerText) || '0');//É -1 PORQUE BUSCA O INDICE DA ULTIMA LINHA DE APOIO E NÃO DA PRIMEIRA LINHA DE VALORES
             descontos.push(desconto);

             const total = converterStringParaDecimal((linhaTotal.cells[i - (ipcv - 1)].innerText) || '0');//É -1 PORQUE BUSCA O INDICE DA ULTIMA LINHA DE APOIO E NÃO DA PRIMEIRA LINHA DE VALORES
             totalGeral.push(total);
         }
     }
     
     // Captura os produtos e valores da tab //
     for (let i = 0; i < corpoTab.length - qlt; i++) {
        const linha = corpoTab[i];
        const idProduto = linha.dataset.id_produto;
        const produto = linha.cells[0]?.innerText || '';
        const quantidade = parseInt(linha.cells[1]?.innerText || '');
        const unidade = linha.cells[2]?.innerText || '';

        if (fornecedores.length > 0) {
            for (let j = 0; j < fornecedores.length; j++) {
                const idFornecedor = idsFornecedores[j];
                const indicePrecoUnitario = ipcv + j * 2;
                const indicePrecoTotal = indicePrecoUnitario + 1;
                const fornecedor = fornecedores[j];
                const valorFrete = custosFrete[j];
                const valorDesconto = descontos[j];
                const valorTotalGeral = totalGeral[j];

                const valorUnitario = converterStringParaDecimal((linha.cells[indicePrecoUnitario]?.innerText) || '0');
                const valorTotal = converterStringParaDecimal((linha.cells[indicePrecoTotal]?.innerText) || '0');

                const condicaoPagamento = linhasDetalhes[j].cells[1]?.innerText || '';
                const observacao = linhasDetalhes[j].cells[2]?.innerText || '';

                const fornecedorAprovado = cabecalho1.cells[j + ipcv].querySelector('input[type="checkbox"]').checked;
                if(fornecedorAprovado){
                    dadosExtrasPDC["Beneficiario"] = fornecedor;
                    dadosExtrasPDC["Valor_orcado"] = valorTotalGeral;
                }
                
                const dadosLinha = {
                    id_produto: idProduto,
                    id_fornecedor: idFornecedor,
                    Produto: produto,
                    Quantidade: quantidade,
                    Unidade: unidade,
                    Fornecedor: fornecedor,
                    Valor_unitario: valorUnitario,
                    Valor_total: valorTotal,
                    Valor_do_frete: valorFrete,
                    Descontos: valorDesconto,
                    Total_geral: valorTotalGeral,
                    Condicoes_de_pagamento: condicaoPagamento,
                    Observacoes: observacao,
                    numero_de_PDC: globais.numPDC,
                    num_PDC_temp: globais.numPDC_temp,
                    Aprovado: fornecedorAprovado, 
                    Versao: 1,
                    Ativo: true
                };
                dados.push(dadosLinha);
            }
        } else {
            const dadosLinha = {
                id_produto: idProduto,
                Produto: produto,
                Quantidade: quantidade,
                Unidade: unidade,
                numero_de_PDC: globais.numPDC,
                num_PDC_temp: globais.numPDC_temp,
                Versao: 1,
                Ativo: true,
            };
            dados.push(dadosLinha);
        }
    }

    return {
        dadostabPrecos: dados,
        dadosExtrasPDC
    };
}

/**
 * Busca os dados de classificação.
 * 
 * @function pegarDadosClassificacao
 * @returns {Object} Os dados de classificação.
 * 
 * @description
 * Esta função busca os dados de classificação a partir de um formulário e os organiza em um objeto.
 */
async function pegarDadosClassificacao() {
    // Busca o formulário de classificação
    const formClassificacao = document.getElementById('form-classificacao');
    const dadosClassificacao = {};
    
    // Busca todas as linhas de classificação
    const linhasClassificacao = formClassificacao.querySelectorAll('.linha-classificacao');
    
    // Array que irá armazenar os dados de cada linha
    const classificacoes = [];
    
    // Itera sobre cada linha de classificação
    linhasClassificacao.forEach(linha => {
        const classificacao = {};
        
        // Busca os selects e inputs da linha atual
        const selects = linha.querySelectorAll('select');
        const inputs = linha.querySelectorAll('input');
        
        // Adiciona os valores dos selects ao objeto da classificação
        selects.forEach(select => {
            if (select.name && select.value) {
                classificacao[select.name] = select.value;
            }
        });
        
        // Adiciona os valores dos inputs ao objeto da classificação
        inputs.forEach(input => {
            if (input.name && input.value) {
                // Se for um campo de valor, converte para decimal
                if (input.classList.contains('input-number')) {
                    classificacao[input.name] = converterStringParaDecimal(input.value);
                } else {
                    classificacao[input.name] = input.value;
                }
            }
        });
        
        // Adiciona a classificação ao array apenas se tiver algum valor preenchido
        if (Object.keys(classificacao).length > 0) {
            classificacoes.push(classificacao);
        }
    });
    
    // Adiciona o array de classificações ao objeto final apenas se houver dados
    if (classificacoes.length > 0) {
        dadosClassificacao["Classificacao_contabil"] = classificacoes;
    }
    
    return dadosClassificacao;
}

//================================================================//
//===========================SALVA TUDO===========================//
//================================================================//
/**
 * Salva os dados da tab.
 * 
 * @function saveTableData
 * @param {Object} options - Opções para a função.
 * @param {String} options.tipo - Tipo de ação a ser realizada (editar ou criar).
 * @returns {Promise} Uma promessa que resolve após a conclusão da ação.
 * 
 * @description
 * Esta função é responsável por salvar os dados da tab. Se uma cotação já existe, ela limpa a cotação antiga e salva a nova. Caso contrário, cria uma nova cotação.
 */
export async function saveTableData({tipo = null}) {

    if (globais.cotacaoExiste) {

        for (const id of idsCotacao) {
            let payload = {
                data: {
                    Ativo: false
                }
            };
            await executar_apiZoho({ tipo: "atualizar_reg", ID: id, corpo: payload });
        }
        globais.cotacaoExiste = false;
        await saveTableData(globais.tipo);
    } else {

        const {dadostabPrecos, dadosExtrasPDC} = await pegarDadostabPrecos();

        const dadosIniciaisPdc = await pegarDadosPDC();
        const dadosClassificacao = await pegarDadosClassificacao();
        const dadosPDC = {...dadosIniciaisPdc, ...dadosExtrasPDC, ...dadosClassificacao};

        //====================CRIA O REGISTRO DO PDC====================//
        let respPDC;
        if(globais.tipo === 'editar_pdc'){

            let payload = {
                data: dadosPDC
            };

            respPDC = await executar_apiZoho({ tipo: "atualizar_reg", ID: globais.idPDC, corpo: payload,  nomeR: globais.nomeRelPDC});
        }else{

            respPDC = await executar_apiZoho({ tipo: "add_reg", corpo: JSON.stringify(dadosPDC, null, 2),  nomeF: globais.nomeFormPDC});

            // Verifica se a resposta foi bem-sucedida e se globais.idPDC é null
            if (respPDC.code === 3000 && globais.idPDC === null) {
                globais.idPDC = respPDC.data.ID; // Preenche globais.idPDC com o ID retornado
            }
        }
        
        //====================CRIA O REGISTRO DA COTAÇÃO====================//
        const json = JSON.stringify(dadostabPrecos, null, 2);
        let respCot = await executar_apiZoho({ tipo: "add_reg", corpo: json });
        
        globais.cotacaoExiste = true;
    }
}

// Função para atualizar o valor original com o total do fornecedor aprovado
export function atualizarValorOriginal() {
    const totalFornecedor = calcularTotalFornecedorAprovado(); // Função que você deve implementar
    const valorOriginalCell = document.getElementById('valor-original');
    valorOriginalCell.innerText = formatToBRL(totalFornecedor);
}

// Função para calcular o total do fornecedor aprovado
function calcularTotalFornecedorAprovado() {
    const table = document.getElementById('priceTable').getElementsByTagName('tbody')[0];
    let total = 0;
    const totalCells = table.querySelectorAll('.total-fornecedor');

    totalCells.forEach(cell => {
        total += converterStringParaDecimal(cell.innerText) || 0;
    });

    return total;
}

// Função para calcular o valor total a pagar com base nos descontos
export function calcularValorTotalPagar() {
    console.log("[CALCULANDO VALOR TOTAL A PAGAR]");
    const valorOriginal = converterStringParaDecimal(document.getElementById('valor-original').innerText) || 0;
    console.log("[Valor original] => ", valorOriginal);
    const descontoCells = document.querySelectorAll('.campos-ret-desc'); // Selecione os inputs de desconto
    let totalDescontos = 0;

    descontoCells.forEach(cell => {
        totalDescontos += converterStringParaDecimal(cell.value) || 0; // Acesse o valor do input
    });
    console.log("[Total descontos] => ", totalDescontos);

    // Atualiza o valor total de descontos no campo "campos-ret-total-desc"
    const totalDescElements = document.getElementsByClassName('campos-ret-total-desc');
    if (totalDescElements.length > 0) {
        totalDescElements[0].innerText = formatToBRL(totalDescontos); // Acessa o primeiro elemento da coleção
    }

    // Inicializa o valor total a pagar com o valor original
    const valorTotalPagar = valorOriginal - totalDescontos;

    // Soma todos os campos "campos-ret-acr"
    const acrescimoCells = document.querySelectorAll('.campos-ret-acr'); // Selecione os inputs de acréscimo
    let totalAcrescimos = 0;

    acrescimoCells.forEach(cell => {
        totalAcrescimos += converterStringParaDecimal(cell.value) || 0; // Acesse o valor do input
    });
    console.log("[Total acréscimos] => ", totalAcrescimos);

    // Atualiza o valor total a pagar com os acréscimos
    const valorTotalFinal = valorTotalPagar + totalAcrescimos;
    console.log("[Total a pagar com acréscimos] => ", valorTotalFinal);
    document.getElementById('valor-total-pagar').innerText = formatToBRL(valorTotalFinal);
}