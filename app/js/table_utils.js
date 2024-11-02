import{formatToBRL, converterParaDecimal, convertToNegative,restrictNumericInput, restrictIntegerInput, executar_apiZoho, baseFornecedores, customModal} from './utils.js'
import{globais, mostrarCamposPagamento} from './main.js'
let selectedCheckbox = null;
const qlt = 4; //Total de linhas de totalizadores, considerando linha com botão de adicionar produto

let idsCotacao = new Array();

//===========================PREENCHE DADOS DO PDC===========================//
export function preencherDadosPDC(resp)
{
    globais.cotacaoExiste = true;

    //==========Preparando dados da cotação==========//
    const data = resp.data[0];

    //==========SESSÃO 1==========//
    const formDadosPDC = document.querySelector('#dados-PDC');
    
    // Select da Entidade
    const selectEntidade = formDadosPDC.querySelector('#entidade');
    if (data.Entidade?.ID) {
        selectEntidade.value = data.Entidade.ID;
    }

    // Descrição da Compra
    const textareaDescricao = formDadosPDC.querySelector('#descricao');
    if (data.Descricao_da_compra) {
        textareaDescricao.value = data.Descricao_da_compra;
    }

    // Utilizaão
    const textareaUtilizacao = formDadosPDC.querySelector('#utilizacao');
    if (data.Utilizacao) {
        textareaUtilizacao.value = data.Utilizacao;
    }

    // =====[SESSÃO 3]=====//
    const formPagamento = document.querySelector('#form-pagamento');

    // Forma de Pagamento
    if (data.Forma_de_pagamento) {
        const radioFormaPagamento = formPagamento.querySelector(`input[name="Forma_de_pagamento"][value="${data.Forma_de_pagamento}"]`);
        if (radioFormaPagamento) {
            radioFormaPagamento.checked = true;
            mostrarCamposPagamento();
        }
    }

    // Campos específicos para Boleto
    if (data.Forma_de_pagamento === 'Boleto') {
        const inputFavorecido = formPagamento.querySelector('#favorecido');
        if (data.Favorecido) {
            inputFavorecido.value = data.Favorecido;
        }
    }

    // Campos específicos para Depósito
    if (data.Forma_de_pagamento === 'Dep. em CC' || data.Forma_de_pagamento === 'Dep. em CP') {
        const inputBanco = formPagamento.querySelector('#banco');
        const inputAgencia = formPagamento.querySelector('#agencia'); 
        const inputConta = formPagamento.querySelector('#conta');
        const inputFavorecidoDeposito = formPagamento.querySelector('#favorecido-deposito');

        if (data.Banco) inputBanco.value = data.Banco;
        if (data.AG) inputAgencia.value = data.AG;
        if (data.N_Conta) inputConta.value = data.N_Conta;
        if (data.Favorecido) inputFavorecidoDeposito.value = data.Favorecido;
    }

    // Preenche as datas de vencimento
    if (data.Vencimento_previsto) {
        const datas = data.Vencimento_previsto.split(',');
        const camposData = document.getElementById('camposData');
        
        // Remove campos existentes
        while (camposData.firstChild) {
            camposData.removeChild(camposData.firstChild);
        }

        // Adiciona campos para cada data
        datas.forEach((data, index) => {
            const [dia, mes, ano] = data.trim().split('/');
            const dataFormatada = `${ano}-${mes}-${dia}`;

            const divParcela = document.createElement('div');
            divParcela.className = 'parcela';
            
            const label = document.createElement('label');
            label.textContent = `Parcela nº ${index + 1}:`;
            
            const input = document.createElement('input');
            input.type = 'date';
            input.name = 'data[]';
            input.value = dataFormatada;
            
            const btnRemover = document.createElement('button');
            btnRemover.type = 'button';
            btnRemover.className = 'removerCampo';
            btnRemover.textContent = 'Remover';
            
            divParcela.appendChild(label);
            divParcela.appendChild(input);
            divParcela.appendChild(btnRemover);
            
            camposData.appendChild(divParcela);
        });
    }

    // Mostra os campos relevantes baseado na forma de pagamento
    const formaPagamentoSelecionada = formPagamento.querySelector('input[name="Forma_de_pagamento"]:checked');
    if (formaPagamentoSelecionada) {
        mostrarCamposPagamento();
    }
}
    
//===========================PREENCHE A TABELA DAS COTAÇÃOES===========================//
export async function prenchTabCot(resp) {
    if (resp && resp.code === 3000 && Array.isArray(resp.data) && resp.data.length > 0) {
        console.log('Código da resposta:', resp.code);
        
        if (resp.data && resp.data.length > 0) {
            console.log('=== Campos do primeiro registro ===');
            Object.entries(resp.data[0]).forEach(([campo, valor]) => {
                console.log(`${campo}:`, valor);
            });
        }

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
        })))].map(item => JSON.parse(item)).sort((a, b) => a.Fornecedor.localeCompare(b.Fornecedor));
        const valoresFrete = [...new Set(data.map(item => item.Valor_do_frete))];
        const valoresAprovado = data.map(item => item.Aprovado);
        const valoresDescontos = [...new Set(data.map(item => item.Descontos))];

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
            restrictIntegerInput()({ target: quantidadeCell });

            //Insere as colunas dos fornecedores na ordem correta
            fornecedores.forEach((fornecedorObj, fornecedorIndex) => {
                //VALOR UNITÁRIO//
                const valorUnitarioCell = newRow.insertCell(fornecedorIndex * 2 + 2);
                valorUnitarioCell.classList.add('numeric-cell');
                valorUnitarioCell.contentEditable = "true";

                //VALOR TOTAL//
                const valorTotalCell = newRow.insertCell(fornecedorIndex * 2 + 3);
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
                const cell = newRow.insertCell(fornecedores.length * 2 + 2);
                
                // Cria o botão//
                const removeButton = document.createElement('button');
                removeButton.classList.add('remove-btn', 'remove-product-btn');

                // Adiciona o evento de clique ao botão//
                console.log('[ADICIONANDO O EVENTO DE CLIQUE]');
                removeButton.addEventListener('click', () => {
                    customModal({
                        botao: removeButton, 
                        tipo: 'remover_produto', 
                        mensagem: 'Deseja realmente remover este produto?<br>Todos os valores deste produto serão removidos.'});
                });
                console.log('[EVENTO DE CLIQUE ADICIONADO]');
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
                console.log('[ADICIONANDO O EVENTO DE CLIQUE 2]');
                // Adiciona o evento de clique ao botão
                removeButton.addEventListener('click', () => {
                    customModal({
                        botao: removeButton, 
                        tipo: 'remover_produto', 
                        mensagem: 'Deseja realmente remover este produto?<br>Todos os valores deste produto serão removidos.'});
                });
                console.log('[EVENTO DE CLIQUE 2 ADICIONADO]');

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
            //Busca as 2 primeiras linhas da tabela (1 - Nome do fornecedor e 2 - Valor unitário e Valor total)//
            const headerRow1 = table.parentElement.querySelector('thead tr:nth-child(1)');
            const headerRow2 = table.parentElement.querySelector('thead tr:nth-child(2)');
            
            const linhaFrete = table.rows[table.rows.length-4];
            const linhaDescontos = table.rows[table.rows.length-3];
            const linhaTotal = table.rows[table.rows.length-2];
            
            fornecedores.forEach((fornecedorObj, index) => {
                //Cria a célula com o nome do fornecedor//
                const celulaCabecalho = document.createElement('th');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = valoresAprovado[index] == 'true' ? true : false;
                checkbox.classList.add('supplier-checkbox');

                checkbox.addEventListener('change', function () {
                    if (checkbox.checked) {
                        if (selectedCheckbox && selectedCheckbox !== checkbox) {
                            selectedCheckbox.checked = false;
                        }
                        selectedCheckbox = checkbox;
                    } else {
                        selectedCheckbox = null;
                    }
                });

                celulaCabecalho.dataset.id_forn = fornecedorObj.id_fornecedor;
                celulaCabecalho.colSpan = 2;
                
                // Cria o botão de remover fornecedor//
                const removeButton = document.createElement('button');
                removeButton.classList.add('remove-btn', 'remove-forn-btn');

                const icon = document.createElement('i');
                icon.classList.add('x-icon', 'icons');
                removeButton.appendChild(icon);
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
                const cellFrete = document.createElement('th');
                cellFrete.innerText = valoresFrete[index];
                cellFrete.classList.add('numeric-cell');
                cellFrete.colSpan = 2;
                cellFrete.contentEditable = "true";
                cellFrete.style.margin = '0 auto';
                linhaFrete.insertBefore(cellFrete, linhaFrete.cells[linhaFrete.cells.length -1]);

                //=====ADICIONA A CELULA DE DESCONTO=====//
                const cellDescontos = document.createElement('th');
                cellDescontos.innerText = valoresDescontos[index] || '0,00';
                cellDescontos.classList.add('numeric-cell');
                cellDescontos.addEventListener('blur', calcularTotais());
                cellDescontos.colSpan = 2;
                cellDescontos.contentEditable = "true";
                cellDescontos.style.margin = '0 auto';
                linhaDescontos.insertBefore(cellDescontos, linhaDescontos.cells[linhaDescontos.cells.length -1]);

                //=====ADICIONA A CELULA DE TOTAL===//
                const totalFornecedor = data
                    .filter(item => item.id_fornecedor === fornecedorObj.id_fornecedor)
                    .reduce((acc, item) => acc + (parseFloat(item.Valor_total) || 0), 0);
                
                const cellTotal = document.createElement('th');
                cellTotal.innerText = formatToBRL(totalFornecedor);
                cellTotal.classList.add('numeric-cell', "total-fornecedor");
                cellTotal.colSpan = 2;
                cellTotal.contentEditable = "true";
                cellTotal.style.margin = '0 auto';
                linhaTotal.insertBefore(cellTotal, linhaTotal.cells[linhaTotal.cells.length -1]);

                // Adiciona linha na tabela de detalhes das propostas
                const otherTable = document.getElementById('otherDataTable');
                const tbodyOther = otherTable.getElementsByTagName('tbody')[0];

                const detailRow = tbodyOther.insertRow();

                const fornCell = detailRow.insertCell();
                fornCell.textContent = fornecedorObj.Fornecedor;

                const condPagCell = detailRow.insertCell();
                const dadosFornecedor = data.find(item => item.id_fornecedor === fornecedorObj.id_fornecedor);
                condPagCell.textContent = dadosFornecedor?.Condicoes_de_pagamento || '';

                const obsCell = detailRow.insertCell();
                obsCell.textContent = dadosFornecedor?.Observacoes || '';
            });
        }
        // Adiciona os cabeçalhos dos fornecedores na ordem correta
        addHeaderForn(fornecedores);
    }
}

//===========================Salvar a tabela===========================//
export async function saveTableData() {
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
        await saveTableData();
    } else {


        //====================BUSCA OS DADOS INICIAIS DO PDC====================//
        const fromDdsInicais = document.querySelector('#dados-PDC');
        const dadosIniciaisPdc = {};
    
        // Obter todos os elementos do formulário
        const elementos = fromDdsInicais.elements;
        for (let elemento of elementos) {
            // Verifica se o campo tem um valor e se está visível (caso de campos ocultos)
            if (elemento.name && (elemento.type !== 'radio' || elemento.checked)) {
                if (elemento.type === 'date' && elemento.value) {
                    const data = new Date(elemento.value);
                    const dia = String(data.getDate()).padStart(2, '0');
                    const mes = String(data.getMonth() + 1).padStart(2, '0');
                    const ano = data.getFullYear();
                    dadosIniciaisPdc[elemento.name] = `${dia}/${mes}/${ano}`;
                } else {
                    dadosIniciaisPdc[elemento.name] = elemento.value;
                }
            }
        }
        dadosIniciaisPdc["id_temp"] = globais.numPDC_temp;

        //====================BUSCA OS DADOS DA TABELA DE PREÇOS====================//
        
        const table = document.getElementById('priceTable');
        const headerRow1 = table.rows[0];
        const rowFrete = table.rows[table.rows.length -3];
        const rowsBody = table.getElementsByTagName('tbody')[0].rows;
        const data = [];
        // Variáveis da segunda tabela (Detalhes das Cotações)
        const otherTable = document.getElementById('otherDataTable');
        const otherRows = otherTable.getElementsByTagName('tbody')[0].rows;

        const suppliers = [];
        const deliveryCosts = [];
        const suplierIds = [];

        // Captura os fornecedores da tabela
        for (let i = 0; i < headerRow1.cells.length; i++) {

            if (headerRow1.cells[i].colSpan > 1) {
                const supplierName = headerRow1.cells[i].innerText.trim().replace(/ \u00d7$/, '');
                const supplierIdForn = headerRow1.cells[i].dataset.id_forn;
                suplierIds.push(supplierIdForn);
                suppliers.push(supplierName);

                const dc = parseFloat((rowFrete.cells[i - 1].innerText).replace(".", "").replace(",", ".") || '0');
                deliveryCosts.push(dc);
            }
            
        }
        
        // Captura os produtos e valores da tabela //
        for (let i = 0; i < rowsBody.length - 3; i++) {
            const row = rowsBody[i];
            const produtoId = row.dataset.id_produto;
            const produto = row.cells[0]?.innerText || '';
            const quantidade = parseInt(row.cells[1]?.innerText || '');

            if (suppliers.length > 0) {
                for (let j = 0; j < suppliers.length; j++) {
                    const fornecedorId = suplierIds[j];
                    const unitPriceIndex = 2 + j * 2;
                    const totalPriceIndex = unitPriceIndex + 1;
                    const fornecedor = suppliers[j];
                    const valor_frete = deliveryCosts[j];

                    const valor_unitario = parseFloat((row.cells[unitPriceIndex]?.innerText).replace(".", "").replace(",", ".") || '0');
                    const valor_total = parseFloat((row.cells[totalPriceIndex]?.innerText).replace(".", "").replace(",", ".") || '0');

                    const condicao_pagamento = otherRows[j].cells[1]?.innerText || '';
                    const observacao = otherRows[j].cells[2]?.innerText || '';

                    const fornecedorAprovado = headerRow1.cells[j + 2].querySelector('input[type="checkbox"]').checked;

                    const rowData = {
                        id_produto: produtoId,
                        id_fornecedor: fornecedorId,
                        Produto: produto,
                        Quantidade: quantidade,
                        Fornecedor: fornecedor,
                        Valor_unitario: valor_unitario,
                        Valor_total: valor_total,
                        Valor_do_frete: valor_frete,
                        Condicoes_de_pagamento: condicao_pagamento,
                        Observacoes: observacao,
                        numero_de_PDC: globais.numPDC,
                        num_PDC_temp: globais.numPDC_temp,
                        Aprovado: fornecedorAprovado, 
                        Versao: 1,
                        Ativo: true
                    };
                    data.push(rowData);
                }
            } else {
                const rowData = {
                    id_produto: produtoId,
                    Produto: produto,
                    Quantidade: quantidade,
                    numero_de_PDC: globais.numPDC,
                    num_PDC_temp: globais.numPDC_temp,
                    Versao: 1,
                    Ativo: true,
                };
                data.push(rowData);
            }
        }
        //====================CRIAR O REGISTRO DO PDC====================//

        let respPDC = await executar_apiZoho({ tipo: "add_reg", corpo: JSON.stringify(dadosIniciaisPdc, null, 2),  nomeF: globais.nomeFormPDC});

        //====================CRIAR O REGISTRO DA COTAÇÃO====================//
        const json = JSON.stringify(data, null, 2);
        let respCot = await executar_apiZoho({ tipo: "add_reg", corpo: json });
        
        /**
        *TODO: PRECISA CRIAR O CÓDIGO PARA ATUALIZAR O STATUS DO PDC
        */ 

        /*
        // Obtém o ID do registro no relatório "Laranj_PDC_Digital_ADM"
        let crit = "(" + (globais.numPDC ? `Numero_do_PDC=="${globais.numPDC}"` : (globais.numPDC_temp ? `id_temp=="${globais.numPDC_temp}"` : "0")) + ")";
        let resp = await executar_apiZoho({ tipo: "busc_reg", criterios: crit, nomeR: "Laranj_PDC_Digital_ADM" });
        let idPdc = resp.data[0].ID;
        */
        
        


        globais.cotacaoExiste = true;
    }
    /*
    if(globais.pag = 'criar_cotacao')
    {
    }
    else if(globais.pag = 'editar_cotacao')
    {
        if (cotacaoExiste) {
            for (const id of idsCotacao) {
                let payload = {
                    data: {
                        Ativo: false
                    }
                };
                await executar_apiZoho({ tipo: "atualizar_reg", ID: id, corpo: payload });
            }
            cotacaoExiste = false;
            await saveTableData();
        } else {
            const table = document.getElementById('priceTable');
            const headerRow1 = table.rows[0];
            const headerRow2 = table.rows[1];
            const rows = table.getElementsByTagName('tbody')[0].rows;
            const data = [];

            // Variáveis da segunda tabela (Detalhes das Cotações)
            const otherTable = document.getElementById('otherDataTable');
            const otherRows = otherTable.getElementsByTagName('tbody')[0].rows;

            const suppliers = [];
            const suplierIds = [];
            let fornecedorAprovadoNome = '';
            let valorTotalFornecedorAprovado = 0;

            // Captura os fornecedores da tabela
            for (let i = 0; i < headerRow1.cells.length; i++) {
                if (headerRow1.cells[i].colSpan > 1) {
                    const supplierName = headerRow1.cells[i].innerText.trim().replace(/ \u00d7$/, '');
                    const supplierIdForn = headerRow1.cells[i].dataset.id_forn;
                    suplierIds.push(supplierIdForn);
                    suppliers.push(supplierName);
                }
            }

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const produtoId = row.dataset.id_produto;
                const produto = row.cells[0]?.innerText || '';
                const quantidade = parseInt(row.cells[1]?.innerText || '');

                // Verifica se o produto foi selecionado pela checkbox
                const produtoAprovado = row.cells[0].querySelector('input[type="checkbox"]').checked;

                if (suppliers.length > 0) {
                    for (let j = 0; j < suppliers.length; j++) {
                        const fornecedorId = suplierIds[j];
                        const unitPriceIndex = 2 + j * 2;
                        const totalPriceIndex = unitPriceIndex + 1;
                        const fornecedor = suppliers[j];
                        const valor_unitario = parseFloat((row.cells[unitPriceIndex]?.innerText).replace(".", "").replace(",", ".") || '');
                        const valor_total = parseFloat((row.cells[totalPriceIndex]?.innerText).replace(".", "").replace(",", ".") || '');

                        const valor_frete = parseFloat((otherRows[j].cells[1]?.innerText).replace(".", "").replace(",", ".") || '');
                        const condicao_pagamento = otherRows[j].cells[2]?.innerText || '';
                        const observacao = otherRows[j].cells[3]?.innerText || '';

                        // Verifica se o fornecedor foi selecionado pela checkbox no header
                        const fornecedorAprovado = headerRow1.cells[j + 2].querySelector('input[type="checkbox"]').checked;
                        if (fornecedorAprovado && fornecedorAprovadoNome == "") {
                            fornecedorAprovadoNome = fornecedor; // Nome do fornecedor aprovado
                        }

                        // Acumula o valor total dos produtos do fornecedor aprovado
                        if ((produtoAprovado && fornecedorAprovado) && (valor_frete != 0)) {
                            valorTotalFornecedorAprovado = valor_total + valor_frete;
                        }

                        const rowData = {
                            id_produto: produtoId,
                            id_fornecedor: fornecedorId,
                            Produto: produto,
                            Quantidade: quantidade,
                            Fornecedor: fornecedor,
                            Valor_unitario: valor_unitario,
                            Valor_total: valor_total,
                            Valor_do_frete: valor_frete,
                            Condicoes_de_pagamento: condicao_pagamento,
                            Observacoes: observacao,
                            numero_de_PDC: numPDC,
                            num_PDC_temp: numPDC_temp,
                            Versao: 1,
                            Ativo: true,
                            Aprovado: produtoAprovado && fornecedorAprovado // Verifica se tanto o produto quanto o fornecedor foram aprovados
                        };

                        data.push(rowData);
                    }
                } else {
                    const rowData = {
                        id_produto: produtoId,
                        Produto: produto,
                        Quantidade: quantidade,
                        numero_de_PDC: numPDC,
                        num_PDC_temp: numPDC_temp,
                        Versao: 1,
                        Ativo: true,
                        Aprovado: produtoAprovado // Apenas a aprovação do produto
                    };
                    data.push(rowData);
                }
            }

            const json = JSON.stringify(data, null, 2);

            // Chama a API para criar os registros no Zoho
            await executar_apiZoho({ tipo: "add_reg", corpo: json });

            // Obtém o ID do registro no relatório "Laranj_PDC_Digital_ADM"
            let crit = "(" + (numPDC ? `Numero_do_PDC=="${numPDC}"` : (numPDC_temp ? `id_temp=="${numPDC_temp}"` : "0")) + ")";
            let resp = await executar_apiZoho({ tipo: "busc_reg", criterios: crit, nomeR: "Laranj_PDC_Digital_ADM" });
            let idPdc = resp.data[0].ID;

            // Atualiza o registro com o fornecedor aprovado e o valor total
            let payloadPdc = {
                data: {
                    Beneficiario: fornecedorAprovadoNome, // Nome do fornecedor
                    Status_geral: "Proposta aprovada",
                    Valor_a_pagar: valorTotalFornecedorAprovado // Soma do valor total dos produtos aprovados
                }
            };
            // Chama a API para atualizar o registro
            await executar_apiZoho({ tipo: "atualizar_reg", ID: idPdc, corpo: payloadPdc, nomeR: "Laranj_PDC_Digital_ADM" });
            cotacaoExiste = true;
        }
    }
    */
}


//================================================//
//==========TUDO AJUSTADO A PARTIR DAQUI==========//
//================================================//

/**
 * Adiciona uma nova linha de produto na tabela de cotação
 * 
 * @function addProductRow
 * @returns {void}
 * 
 * @description
 * Esta função:
 * - Insere uma nova linha na tabela antes das linhas de totalizadores
 * - Configura um ID único para o novo produto
 * - Cria células editáveis para:
 *   - Descrição do produto (primeira coluna)
 *   - Quantidade (segunda coluna, apenas números inteiros)
 *   - Valores unitários (colunas pares, aceita decimais)
 * - Adiciona botão de remoção na última coluna
 * - Atualiza os listeners da tabela
 */
export function addProductRow() {
    // Obtém referência ao corpo da tabela
    const table = document.getElementById('priceTable').getElementsByTagName('tbody')[0];
    
    // Insere nova linha antes dos totalizadores
    const newRow = table.insertRow(table.rows.length - qlt);
    newRow.dataset.id_produto = globais.idProduto;
    globais.idProduto = (globais.idProduto + 1);
    const rowCount = table.rows[0].cells.length;

    // Configura as células da nova linha
    for (let i = 0; i < rowCount; i++) {
        const newCell = newRow.insertCell(i);
        if (i === 0) {
            // Coluna de descrição do produto
            newCell.contentEditable = "true";
        } else if (i === 1) {
            // Coluna de quantidade (apenas números inteiros)
            newCell.contentEditable = "true";
            newCell.classList.add('numeric-cell', 'integer-cell');
        } else if (i % 2 === 0 && i < rowCount - 1) {
            // Colunas de valores unitários (aceita decimais)
            newCell.contentEditable = "true";
            newCell.classList.add('numeric-cell');
        } else if (i === rowCount - 1) {
            // Última coluna - botão de remoção
            const removeButton = document.createElement('button');
            removeButton.classList.add('remove-btn', 'remove-product-btn');

            console.log('[ADICIONANDO O EVENTO DE CLIQUE 1]');
            removeButton.addEventListener('click', () => {
                customModal({
                    botao: removeButton, 
                    tipo: 'remover_produto', 
                    mensagem: 'Deseja realmente remover este produto?<br>Todos os valores deste produto serão removidos.'
                });
            });
            console.log('[EVENTO DE CLIQUE 1 ADICIONADO]');

            const icon = document.createElement('i');
            icon.classList.add('trash-icon', 'icons');
            removeButton.appendChild(icon);

            newCell.classList.add('action-buttons');
            newCell.appendChild(removeButton);
        } else {
            // Células de totais (não editáveis)
            newCell.innerText = "";
        }
    }

    // Atualiza os listeners da tabela
    autalizarOuvintesTabCot();
}

/**
 * Remove a linha do produto selecionado da tabela de cotação
 * 
 * @function removeRow
 * @param {HTMLElement} button - Botão de remoção que foi clicado
 * @returns {void}
 * 
 * @description
 * - Verifica se existe mais de uma linha na tabela antes de remover
 * - Remove a linha do produto selecionado se houver mais de uma linha
 * - Exibe alerta se tentar remover a última linha da tabela
 */
export function removeRow(button) {
    // Obtém referência ao corpo da tabela de preços
    const table = document.getElementById('priceTable').getElementsByTagName('tbody')[0];

    // Verifica se há mais de uma linha antes de remover
    if (table.rows.length > 1) {
        // Navega do botão até a linha (tr) e remove
        const row = button.parentNode.parentNode;
        row.parentNode.removeChild(row);
    } else {
        // Impede remoção da última linha
        alert("Não é possível remover a última linha.");
    }
    calcularTotais();
}

/**
 * Adiciona um novo fornecedor à tabela de cotação
 * 
 * @function addSupplierColumn
 * @returns {void}
 * 
 * @description
 * Esta função:
 * - Cria um popup com dropdown para seleção de fornecedor
 * - Permite pesquisar fornecedores na lista
 * - Adiciona colunas para o fornecedor selecionado na tabela principal:
 *   - Nome do fornecedor com checkbox e botão de remoção
 *   - Colunas para valor unitário e total
 * - Adiciona linha correspondente na tabela de dados adicionais
 * - Mantém a formatação e estrutura das tabelas
 */
export function addSupplierColumn() {
    // Configurações
    const qtdCaract = 20; // Limite de caracteres para exibição do nome do fornecedor
    const tabela = document.getElementById('priceTable');
    const cabecalhoLinha1 = tabela.rows[0];
    const cabecalhoLinha2 = tabela.rows[1];
    
    //==========Criação do Dropdown de Fornecedores==========//
    // Container principal do dropdown
    const containerFornecedor = document.createElement('div');
    containerFornecedor.classList.add('container-fornecedor');
    containerFornecedor.style.position = 'relative';

    // Botão que abre o dropdown
    const botaoAbrirDropdown = document.createElement('button');
    botaoAbrirDropdown.classList.add('dropdown-btn');
    botaoAbrirDropdown.innerText = 'Selecione um fornecedor';

    // Container do conteúdo do dropdown
    const listaDropdown = document.createElement('div');
    listaDropdown.classList.add('dropdown-content');

    // Campo de pesquisa de fornecedores
    const campoPesquisa = document.createElement('input');
    campoPesquisa.type = 'text';
    campoPesquisa.placeholder = 'Pesquisar fornecedor...';
    campoPesquisa.classList.add('campo-pesquisa-fornecedor');
    listaDropdown.appendChild(campoPesquisa);

    // Container das opções de fornecedores
    const containerOpcoes = document.createElement('div');
    containerOpcoes.classList.add('opcoes-container');

    //==========Populando o Dropdown==========//
    let qtdForn = 0;
    baseFornecedores.forEach((dds_forn, id_forn) => {
        qtdForn++;
        let nome_forn = dds_forn[0];
        let cnpj_forn = dds_forn[1];
        const nomeCompleto = nome_forn;

        // Limita o tamanho do nome para exibição
        if (nome_forn.length > qtdCaract) {
            nome_forn = nome_forn.substring(0, qtdCaract) + '...';
        }

        // Cria opção do fornecedor
        const opcao = document.createElement('div');
        opcao.classList.add('dropdown-opcao');
        opcao.dataset.id_forn = id_forn;
        opcao.innerText = `${nome_forn} - ${cnpj_forn}`;
        opcao.title = nomeCompleto;

        // Handler de clique na opção do fornecedor
        opcao.onclick = () => {
            let nome_forn = opcao.innerText;
            

            if (nome_forn.length > qtdCaract) {
                nome_forn = nome_forn.substring(0, qtdCaract) + '...';
            }

            //==========Criação das Colunas do Fornecedor==========//
            const celulaCabecalho = document.createElement('th');
            celulaCabecalho.colSpan = 2;
            celulaCabecalho.dataset.id_forn = id_forn;
            celulaCabecalho.title = nome_forn;
            
            const nomeFornText = document.createTextNode(nome_forn);

            // Botão de remoção do fornecedor
            const removeButton = document.createElement('button');
            removeButton.classList.add('remove-btn', 'remove-forn-btn');
            removeButton.addEventListener('click', () => {
                customModal({
                    botao: removeButton, 
                    tipo: 'remover_fornecedor',
                    mensagem: `Deseja realmente remover o fornecedor <b>${nomeCompleto}</b>?<br>Todos os valores deste fornecedor serão removidos.`
                });
            });

            const icon = document.createElement('i');
            icon.classList.add('x-icon', 'icons');
            removeButton.appendChild(icon);

            // Checkbox de seleção do fornecedor
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('supplier-checkbox');
            checkbox.addEventListener('change', function () {
                if (checkbox.checked) {
                    if (selectedCheckbox && selectedCheckbox !== checkbox) {
                        selectedCheckbox.checked = false;
                    }
                    selectedCheckbox = checkbox;
                } else {
                    selectedCheckbox = null;
                }
            });

            // Montagem do container do fornecedor
            const container = document.createElement('div');
            container.classList.add('container-fornecedor');
            container.style.display = 'flex';
            container.style.alignItems = 'center';
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
            const linhas = tabela.getElementsByTagName('tbody')[0].rows;
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

            //==========Atualização da Tabela de Dados Adicionais==========//
            const otherTableBody = document.getElementById('otherDataTable').getElementsByTagName('tbody')[0];
            
            if (otherTableBody.rows.length === 1 && !otherTableBody.rows[0].cells[0].textContent.trim()) {
                otherTableBody.deleteRow(0);
            }
            
            const newRow = otherTableBody.insertRow();
            const fornecedorCell = newRow.insertCell(0);
            fornecedorCell.innerText = nome_forn;
            fornecedorCell.dataset.id_forn = id_forn;

            const condicoesPagamentoCell = newRow.insertCell(1);
            const observacoesCell = newRow.insertCell(2);

            [condicoesPagamentoCell, observacoesCell].forEach(cell => {
                cell.contentEditable = "true";
                cell.classList.add('editable-cell');
            });

            document.body.removeChild(popupFornecedor);
            autalizarOuvintesTabCot();
        };

        containerOpcoes.appendChild(opcao);
    });

    listaDropdown.appendChild(containerOpcoes);

    // Eventos do dropdown
    botaoAbrirDropdown.onclick = () => {
        listaDropdown.classList.toggle('show');
        listaDropdown.style.display = listaDropdown.style.display === 'block' ? 'none' : 'block';
        campoPesquisa.focus();
    };

    // Filtro de pesquisa
    campoPesquisa.addEventListener('input', () => {
        const filtro = campoPesquisa.value.toLowerCase();
        const opcoes = containerOpcoes.getElementsByClassName('dropdown-opcao');
        for (let i = 0; i < opcoes.length; i++) {
            const opcao = opcoes[i];
            const texto = opcao.innerText.toLowerCase();
            opcao.style.display = texto.includes(filtro) ? '' : 'none';
        }
    });

    containerFornecedor.appendChild(botaoAbrirDropdown);
    containerFornecedor.appendChild(listaDropdown);

    //==========Criação do Popup==========//
    const popupFornecedor = document.createElement('div');
    popupFornecedor.classList.add('popup-fornecedor');

    const cabecalhoPopup = document.createElement('div');
    cabecalhoPopup.classList.add('cabecalho-popup');
    cabecalhoPopup.innerText = 'Selecione um fornecedor';

    const botaoFechar = document.createElement('button');
    const iconFechar = document.createElement('i');
    iconFechar.classList.add('x-icon', 'icons');
    botaoFechar.appendChild(iconFechar);
    botaoFechar.classList.add('btn-fechar');
    botaoFechar.onclick = () => document.body.removeChild(popupFornecedor);

    cabecalhoPopup.appendChild(botaoFechar);
    popupFornecedor.appendChild(cabecalhoPopup);
    popupFornecedor.appendChild(containerFornecedor);
    document.body.appendChild(popupFornecedor);
}

/**
 * Remove as colunas de um fornecedor selecionado da tabela de cotação
 * 
 * @function removeSupplierColumn
 * @param {HTMLElement} button - Botão de remoção que foi clicado
 * @returns {void}
 * 
 * @description
 * - Remove as colunas relacionadas ao fornecedor selecionado da tabela principal (valor unitário e total)
 * - Remove a célula mesclada do fornecedor no cabeçalho
 * - Remove as células de totalizadores para o fornecedor
 * - Remove a linha correspondente na tabela de dados adicionais
 * - Mantém a estrutura e formatação da tabela
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

    // Remove células do corpo da tabela
    const rows = tbody.rows;
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        
        if (i < rows.length - qlt) {
            // Remove células de produtos (2 colunas por fornecedor)
            const baseIndex = colIndex * 2 - 2;
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

    // Remove linha correspondente na tabela de dados adicionais
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
    const quantity = converterParaDecimal(quantityCell.innerText); //Converte a quantidade para um número decimal

    for (let i = 2; i < row.cells.length; i += 2) {
        const unitPriceCell = row.cells[i]; //Valor unitário do item
        const totalPriceCell = row.cells[i + 1]; //Valor total do item

        if (unitPriceCell && totalPriceCell) {
            const unitPrice = converterParaDecimal(unitPriceCell.innerText); //Converte o valor unitário para um número decimal
            totalPriceCell.innerText = formatToBRL((quantity * unitPrice)); //Calcula o valor total e formata para o padrão brasileiro
        }
    }

}

/**
 * Calcula o valor total para cada fornecedor na tabela de cotação
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
        const vlrsFrete = (converterParaDecimal(table.rows[table.rows.length - qlt].cells[index + 1].textContent) || 0);
        const vlrsDesconto = (converterParaDecimal(table.rows[table.rows.length - 3].cells[index + 1].textContent) || 0);
        for (let i = 0; i < table.rows.length - qlt; i++)
        {
            const ci = 3; //Coluna inicial da busca
            const linha = table.rows[i];

            const valorTotalCell = linha.cells[(index * 2) + ci];
            vt += (converterParaDecimal(valorTotalCell.textContent || '0') || 0);
        }
        totalCell.textContent = formatToBRL((vt + vlrsFrete + vlrsDesconto).toFixed(2));
    });
}

/**
 * Manipula o evento de colar (paste) na tabela de preços
 * Permite colar dados de planilhas externas na tabela de cotação, mantendo a formatação e cálculos
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
 * - Recalcula os totais das linhas e da tabela
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

            cells[startCellIndex + cellIndex].innerText = pastedRows[rowIndex][cellIndex];
        }

        calculateTotalPrices(startRowIndex + rowIndex);
    }
    calcularTotais();
}

/**
 * Manipula o evento de colar (paste) na tabela de detalhes dos fornecedores
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

/**
 * Atualiza os listeners da tabela de cotação
 * Remove todos os listeners existentes e adiciona novamente para garantir funcionamento correto
 * 
 * @function autalizarOuvintesTabCot
 * @returns {void}
 * 
 * @description
 * - Remove todos os listeners existentes
 * - Adiciona novamente os listeners necessários para garantir o funcionamento correto
 */
export function autalizarOuvintesTabCot() {
    const tabela = document.getElementById('priceTable').getElementsByTagName('tbody')[0];
    const lv = tabela.rows;

    if (!tabela) return;

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
    tabela.querySelectorAll('.numeric-cell').forEach(celula => {
        celula.addEventListener('input', () => restrictNumericInput(celula));
    });

    // Adiciona listener para converter valores negativos na antepenúltima linha
    const atpl = tabela.rows[tabela.rows.length - 3];
    for (let i = 0; i < atpl.cells.length; i++) {
        const celula = atpl.cells[i];
        celula.addEventListener('blur', () => {
            const valor = converterParaDecimal(celula.innerText);
            if (!isNaN(valor)) {
                celula.innerText = convertToNegative(valor);
            }
        }, {capture: true});
    }

    // Adiciona listeners para células da tabela principal
    for (let i = 0; i < lv.length - 2; i++) {
        const linha = lv[i];
        
        // Adiciona apenas o listener de paste para a primeira coluna
        linha.cells[0].addEventListener('paste', (event) => handlePasteEventPriceTable(event));
        
        // Adiciona todos os listeners para as demais colunas
        for (let j = 1; j < linha.cells.length - 1; j++) {
            const celula = linha.cells[j];
            celula.addEventListener('paste', (event) => handlePasteEventPriceTable(event));
            celula.addEventListener('input', () => restrictNumericInput(celula));
            celula.addEventListener('blur', () => formatToBRL(celula));
            if (i < lv.length - qlt) {
                celula.addEventListener('blur', () => calculateTotalPrices(i));
            }
            celula.addEventListener('blur', () => calcularTotais());
        }
    }
}

/**
 * Atualiza os ouvintes de eventos da tabela de detalhes dos fornecedores.
 * Adiciona um ouvinte de evento 'paste' para cada linha da tabela, exceto o cabeçalho.
 * Isso permite que os dados sejam colados corretamente na tabela de detalhes.
 * 
 * @function atualizarOuvintesTabDetlhesForn
 * @returns {void}
 * 
 * @description
 * - Adiciona um ouvinte de evento 'paste' para cada linha da tabela, exceto o cabeçalho
 * - Isso permite que os dados sejam colados corretamente na tabela de detalhes
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