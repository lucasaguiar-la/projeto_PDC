import { globais } from './main.js';
import { prenchTabCot, saveTableData, preencherDadosPDC, autalizarOuvintesTabCot, removeSupplierColumn, removeRow } from './table_utils.js'

export let baseFornecedores = new Map();
export let classificacoes = new Map();

//==========Busca os dados iniciais da página==========//
export async function executarProcessosInicias() {
    await ZOHO.CREATOR.init()
    //=====Busca os parâmetros da página=====//
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
    console.log(`numPDC => ${globais.numPDC}`);
    console.log(`numPDC_temp => ${globais.numPDC_temp}`);
    console.log(`pag => ${globais.pag}`);
    //=====BUSCA OS DADOS INICIAIS DO PDC, CASO EXISTAM=====//
    let cPDC = "(" + (globais.numPDC ? `numero_de_PDC=="${globais.numPDC}"` : (globais.numPDC_temp ? `id_temp=="${globais.numPDC_temp}"` : "ID==0")) + ")";

    let respPDC = await executar_apiZoho({ tipo: "busc_reg", criterios: cPDC, nomeR: globais.nomeRelPDC })
    if (respPDC.code == 3000) {
        //PREENCHE A TABELA COM OS DADOS DO PDC//
        console.log("Tem PDC");
        preencherDadosPDC(respPDC);

    } else {
        //CRIA OS CAMPOS PARA PREENCHER DADOS DO PDC//
        console.log("Não tem PDC")
    }

    //=====BUSCA OS DADOS INICIAIS DA COTAÇÃO, CASO EXISTAM=====//
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

    //=====BUSCA OS FORNECEDORES=====//
    executar_apiZoho();
    //buscarPlanContas();

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
    autalizarOuvintesTabCot();
}

//=====BUSCA O PLANO DE CONTAS=====//
export function buscarPlanContas() {
    console.log("[BUSCANDO PLANO DE CONTAS]");
    let cPlanContas = "(ID!=0)";
    
    // Busca os dados do plano de contas
    executar_apiZoho({
        tipo: "busc_reg_recursivo", 
        criterios: cPlanContas, 
        nomeR: globais.nomeRelPlanoContas
    }).then((resp) => {
        // Mapeia as classificações e centros de custo
        const classificacoesMap = new Map();
        const centrosCustoMap = new Map();
        const relacionamentos = new Map(); // Para armazenar relações entre classe e centros
        console.log("[CRIANDO OS MAPAS DE CLASSIFICAÇÕES E CENTROS DE CUSTO]");
        resp.forEach((item) => {
            // Monta o par classe operacional
            const codigoClasse = item.C_digo_da_classe_operacional;
            const nomeClasse = item.Nome_da_classe;
            const classeKey = `${codigoClasse} - ${nomeClasse}`;
            classificacoesMap.set(codigoClasse, classeKey);
    
            // Monta o par centro de custo
            const codigoCentro = item.Cod_do_centro_de_custo;
            const nomeCentro = item.Nome_do_centro_de_custo;
            const centroKey = `${codigoCentro} - ${nomeCentro}`;
            centrosCustoMap.set(codigoCentro, centroKey);
    
            // Armazena relacionamento
            if (!relacionamentos.has(codigoClasse)) {
                relacionamentos.set(codigoClasse, new Set());
            }
            relacionamentos.get(codigoClasse).add(codigoCentro);
        });
    
        // Armazena os dados em variáveis globais para uso posterior
        globais.classificacoes = classificacoesMap;
        globais.centrosCusto = centrosCustoMap;
        globais.relacionamentosCentroCusto = relacionamentos;
    
        // Popula os selects
        popularSelects(classificacoesMap, centrosCustoMap);
    });
}
console.log("[POPULANDO OS SELECTS]");
export function popularSelects(classificacoes, centrosCusto) {
    // Busca todos os conjuntos de selects dentro do form-classificacao
    const classificacaoForm = document.getElementById('form-classificacao');
    const todasClassificacoes = classificacaoForm.querySelectorAll('.classificacao');
    
    todasClassificacoes.forEach(container => {
        // Seleciona os selects dentro de cada container de classificação
        const selectCentro = container.querySelector('select[name="Centro"]');
        const selectClassificacao = container.querySelector('select[name="Classe"]');
        
        // Popula select de centros de custo primeiro
        if (selectCentro) {
            selectCentro.innerHTML = '<option value="">Selecione...</option>';
            Array.from(centrosCusto.values()).forEach(centro => {
                selectCentro.innerHTML += `<option value="${centro}">${centro}</option>`;
            });

            // Adiciona listener para filtrar classes operacionais
            selectCentro.addEventListener('change', (e) => {
                const codigoCentro = e.target.value.split(' - ')[0];
                const classeSelect = e.target.closest('.classificacao').querySelector('select[name="Classe"]');
                filtrarClassesOperacionais(codigoCentro, classeSelect);
            });
        }

        // Popula select de classificações com todas as opções inicialmente
        if (selectClassificacao) {
            selectClassificacao.innerHTML = '<option value="">Selecione...</option>';
            Array.from(classificacoes.values()).forEach(classe => {
                selectClassificacao.innerHTML += `<option value="${classe}">${classe}</option>`;
            });
        }
    });
}

export function filtrarClassesOperacionais(codigoCentro, selectClasse) {
    if (!selectClasse) return;

    selectClasse.innerHTML = '<option value="">Selecione...</option>';
    
    if (!codigoCentro) {
        // Se nenhum centro selecionado, mostra todas as classes
        Array.from(globais.classificacoes.values()).forEach(classe => {
            selectClasse.innerHTML += `<option value="${classe}">${classe}</option>`;
        });
        return;
    }

    // Filtra apenas as classes relacionadas ao centro de custo selecionado
    const classesRelacionadas = new Set();
    globais.relacionamentosCentroCusto.forEach((centros, codigoClasse) => {
        if (centros.has(codigoCentro)) {
            const classe = globais.classificacoes.get(codigoClasse);
            if (classe) {
                classesRelacionadas.add(classe);
            }
        }
    });

    classesRelacionadas.forEach(classe => {
        selectClasse.innerHTML += `<option value="${classe}">${classe}</option>`;
    });
}

//===========================Executar quaisquer requisições do zoho===========================//
export async function executar_apiZoho({ tipo = null, criterios = null, ID = null, corpo = null, nomeR = null, nomeF = null } = {}) {
    try {
        nomeR = nomeR ? nomeR : globais.nomeRelCot;
        nomeF = nomeF ? nomeF : globais.nomeFormCot;
        await ZOHO.CREATOR.init();
        let recOps = await ZOHO.CREATOR.API;

        // Função de buscar registro
        async function busc_reg(nomeR, criterio, numPag) {
            const config = {
                appName: globais.nomeApp,
                reportName: nomeR,
                criteria: criterio,
                page: numPag,
                pageSize: 200
            };
            return recOps.getAllRecords(config);
        }

        // Função de criar registro
        async function criar_reg(ddsCriacao) {

            ddsCriacao = { "data": ddsCriacao };
            const config = {
                appName: globais.nomeApp,
                formName: nomeF,
                data: ddsCriacao
            };
            return recOps.addRecord(config);
        }

        // Função de atualizar registro
        async function atualizar_reg(nomeR, ID, corpo) {

            return await recOps.updateRecord({
                appName: globais.nomeApp,
                reportName: nomeR,
                id: ID,
                data: corpo
            });
        }
        // Busca todos os fornecedores  e joga na base
        async function buscarFornecedores() {

            let numPag = 1;
            let criterio = `(ID!=0)`;
            let relForn = `Base_de_fornecedores_Laranjeiras_Report`
            let temForn = true;
            while (temForn) {
                try {

                    const resp = await busc_reg(relForn, criterio, numPag)
                    if (resp && resp.code === 3000 && Array.isArray(resp.data)) {
                        if (resp.data.length > 0) {
                            const data = resp.data;
                            data.forEach((item) => {
                                baseFornecedores.set(item["Numero_do_fornecedor"], [item["Nome_do_fornecedor"],
                                item["Cpf_Cnpj_do_fornecedor"], item["Valor_do_frete"], item["Condicoes_de_pagamento"],
                                item["Observacoes"]]);
                            });
                        } else {

                            temForn = false;
                        }
                    } else {

                        temForn = false;
                    }

                } catch (err) {

                    temForn = false;
                }
                numPag++;
            }
        }

        async function buscarRecursivamente(nomeR, criterio) {
            let baseApoio = new Map();
            let paginaAtual = 1;

            try {
                while (true) {
                    const resp = await busc_reg(nomeR, criterio, paginaAtual);
                    
                    // Verifica se a resposta é válida e tem dados
                    if (!resp || resp.code !== 3000 || !Array.isArray(resp.data)) {
                        break;
                    }

                    // Se não há mais dados, interrompe o loop
                    if (resp.data.length === 0) {
                        break;
                    }

                    // Processa os dados recebidos
                    resp.data.forEach((item) => {
                        const id = item.ID || item.C_digo_da_classe_operacional;
                        baseApoio.set(id, item);
                    });

                    // Log dos dados (se necessário em ambiente de desenvolvimento)
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`Dados da página ${paginaAtual} processados`);
                    }

                    paginaAtual++;
                }
            } catch (err) {
                console.error("Erro ao buscar dados:", err);
            }

            // Retorna os dados coletados, mesmo que vazio
            return Array.from(baseApoio.values());
        }

        // Funções solicitadas conforme tipo
        if (tipo === "add_reg") {

            return await criar_reg(corpo);
        } else if (tipo === "atualizar_reg") {

            return await atualizar_reg(nomeR, ID, corpo);
        } else if (tipo === "busc_reg") {

            return await busc_reg(nomeR, criterios, 1);
        } else if (tipo === "busc_reg_recursivo") {
            return await buscarRecursivamente(nomeR, criterios);
        } else {
            buscarFornecedores();
        }
    } catch (err) {
        return err;
    }
}

//=====Formata as células de valores para o formato BRL=====//
export function formatToBRL(v) {
    console.log("[FORMATANDO PARA BRL]");
    console.log("Valor:", v);
    let av; //Apoio ao valor
    let int = false; //Flag para inteiro
    let isNeg = false; //Flag para negativo

    if ((typeof v == "string" || typeof v == "number") && v !== "") {
        av = converterStringParaDecimal(v);
    } else {
        av = v.innerText;
        int = v.classList.contains("integer-cell");
    }
    console.log("Valor após conversão:", av);

    // Verifica se é negativo
    if (av.toString().startsWith('-')) {
        isNeg = true;
        av = av.toString().substring(1);
    }
    console.log("Valor após verificar se é negativo:", av);
    av = int ? av : converterStringParaDecimal(av);
    av = /[.,]/.test(av) || int ? av : `${av}00`;

    let avc = (av.toString().split('.')[1] || '').length == 1 ? (`${av}0`).replace(/[^0-9]/g, '') : av.toString().replace(/[^0-9]/g, '');

    let pi = (avc.slice(0, -2) || (int ? '' : '0')).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    let pd = avc.slice(-2);
    console.log("Valor após formatar:", av);
    let vf = int ? `${pi}${pd}` : `${pi},${pd}`;
    
    // Adiciona o sinal negativo de volta se necessário
    if (isNeg) {
        vf = `-${vf}`;
    }
    console.log("Valor final:", vf);
    if (v.innerText) {
        v.innerText = vf;
        return;
    } else {
        return vf;
    }
}

/**
 * Converte uma string em um valor decimal, removendo caracteres não numéricos
 * e padronizando a formatação
 * 
 * @function converterStringParaDecimal 
 * @param {string|number|HTMLElement} valor - Valor ou elemento a ser convertido
 * @returns {number} Valor decimal formatado
 *
 * @example
 * converterStringParaDecimal("ABC123") // retorna 123.00
 * converterStringParaDecimal("ABC123.12") // retorna 123.12
 * converterStringParaDecimal(elementoHTML) // atualiza o innerText e retorna o valor
 */
export function converterStringParaDecimal(valor) {
    // Verifica se é um elemento HTML
    const isElement = valor && typeof valor === 'object' && 'innerText' in valor;
    const valorOriginal = isElement ? valor.innerText : valor;
    
    if (!valorOriginal) return 0.00;
    
    // Remove todos os caracteres não numéricos exceto ponto e vírgula
    let numeroLimpo = valorOriginal.toString().replace(/[^\d.,\-]/g, '');
    
    // Trata números negativos
    const isNegative = numeroLimpo.startsWith('-');
    numeroLimpo = numeroLimpo.replace('-', '');
    
    // Conta quantos pontos e vírgulas existem
    const qtdPontos = (numeroLimpo.match(/\./g) || []).length;
    const qtdVirgulas = (numeroLimpo.match(/,/g) || []).length;
    
    // Se tiver mais de um separador do mesmo tipo, considera como separador de milhar
    if (qtdPontos > 1 || qtdVirgulas > 1) {
        numeroLimpo = numeroLimpo.replace(/[.,]/g, '');
    } else if (qtdPontos === 1 && qtdVirgulas === 1) {
        const posicaoPonto = numeroLimpo.lastIndexOf('.');
        const posicaoVirgula = numeroLimpo.lastIndexOf(',');
        
        if (posicaoPonto > posicaoVirgula) {
            numeroLimpo = numeroLimpo.replace(',', '');
        } else {
            numeroLimpo = numeroLimpo.replace('.', '').replace(',', '.');
        }
    } else if (qtdVirgulas === 1) {
        numeroLimpo = numeroLimpo.replace(',', '.');
    }
    
    // Converte para número e fixa em 2 casas decimais
    let numeroFinal = parseFloat(numeroLimpo);
    numeroFinal = isNaN(numeroFinal) ? 0.00 : Number(numeroFinal.toFixed(2));
    
    // Aplica o sinal negativo se necessário
    if (isNegative) {
        numeroFinal = -numeroFinal;
    }
    
    // Se for um elemento HTML, atualiza o innerText com o valor formatado
    if (isElement) {
        valor.innerText = numeroFinal.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    return numeroFinal;
}

export function convertToNegative(v) {

    return v > 0 ? (v * -1) : v;
}

/*Restringe células a apenas conteúdo numérico*/
export function restrictNumericInput(obj) {
    const input = obj.innerText;
    const filteredInput = input.replace(/[^0-9.,]/g, '');
    if (input !== filteredInput) {
        obj.innerText = filteredInput;
    }
}

/*Restringe células a apenas conteúdo inteiro*/
export function restrictIntegerInput(event) {
    // Verifica se recebeu um evento ou um elemento direto
    const element = event.target || event;
    
    if (!element || !element.innerText) return;
    
    const input = element.innerText;
    const filteredInput = input.replace(/[^0-9]/g, '');
    
    if (input !== filteredInput) {
        element.innerText = filteredInput;
    }
}

/*Converte para formato numérico (0.000,00)*/
export function convertNumberFormat(number) {
    try {
        if (typeof number === 'string') {
            // Remove qualquer formatação anterior de pontos e vírgulas
            number = number.replace(/[^\d.-]/g, '');
        }
        let numericValue = parseFloat(number);
        if (!isNaN(numericValue)) {
            return numericValue.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } else {
            return '';
        }
    } catch (err) {
        return '';
    }
}

//==============================Cria uma tela de confirmação customizada====================================//
export async function customModal({botao = null, tipo, titulo = null, mensagem}) {
    console.log('[ENTROU NO CUSTOM BUTTON]');
    console.log("Botao:", botao);
    console.log("Tipo:", tipo);
    console.log("Titulo:", titulo);
    console.log("Mensagem:", mensagem);

    // Criação do overlay
    const overlay = document.createElement('div');
    overlay.classList.add('customConfirm-overlay-div');

    // Criação da janela do popup
    const popup = document.createElement('div');
    popup.classList.add('customConfirm-div');

    // Título
    const titleElement = document.createElement('h3');
    if(titulo)
    {
        titleElement.classList.add('customConfirm-title');
        titleElement.innerHTML = titulo;
        popup.appendChild(titleElement);
    }

    // Mensagem
    const messageElement = document.createElement('p');
    messageElement.innerHTML = mensagem;
    messageElement.classList.add('customConfirm-message');

    // Botão Confirmar
    const confirmButton = document.createElement('button');
    confirmButton.innerHTML = 'Confirmar';
    confirmButton.classList.add('customConfirm-confirmButton');
    let inputElement;
    // Adiciona classe específica baseada no tipo e campo de texto
    if (tipo === 'ajustar_cot') {
        // CLasse do botão
        confirmButton.classList.add('customAdjust-confirmButton');
        // Campo de texto para ajuste
        inputElement = document.createElement('textarea');
        inputElement.classList.add('customAdjust-textarea');
        inputElement.placeholder = 'Ex.: Gostaria que o valor de frete fosse alterado...';
        popup.appendChild(inputElement);
        inputElement.style.width = '100%';
        inputElement.style.height = '100px';
    } else if (tipo === 'arquivar_cot') {
        // CLasse do botão
        confirmButton.classList.add('customArchive-confirmButton');
        // Campo de texto para motivo da arquivação
        inputElement = document.createElement('textarea');
        inputElement.classList.add('customAdjust-textarea');
        inputElement.placeholder = 'Ex.: Arquivo devido a não resposta do fornecedor...';
        popup.appendChild(inputElement);
        inputElement.style.width = '100%';
        inputElement.style.height = '100px';
    }
    

    // Botão Cancelar
    const cancelButton = document.createElement('button');
    cancelButton.innerHTML = 'Cancelar';
    cancelButton.classList.add('customConfirm-cancelButton');

    // Elemento de carregamento
    const loadingElement = document.createElement('div');
    loadingElement.classList.add('customConfirm-loading');
    loadingElement.innerHTML = '<div class="customConfirm-loading-spinner"></div> Carregando, aguarde...';

    // Ação ao clicar em Confirmar
    confirmButton.addEventListener('click', async function () {
        // Esconde os botões e a mensagem original, exibe o carregamento
        const elementsToHide = [confirmButton, cancelButton, titleElement, messageElement];
        elementsToHide.forEach(el => el.style.display = 'none');
        loadingElement.style.display = 'flex';

        try {
            const url = 'https://guillaumon.zohocreatorportal.com/';
            switch (tipo) {
                case 'salvar_cot':
                case 'aprovar_cot':
                    await saveTableData();
                    window.open(tipo === 'salvar_cot' ? `${url}#Script:page.refresh` : `${url}#Script:dialog.close`, '_top');
                    break;

                case 'ajustar_cot':
                    const textoAjuste = inputElement.value.trim();
                    if (!textoAjuste) {
                        alert("Por favor, preencha o campo de ajuste.");
                        return;
                    }
                    console.log("É ajustar cot");
                    await executar_apiZoho({
                        tipo: "atualizar_reg", ID: globais.idPDC, corpo: {
                            Solicitacao_de_ajuste: textoAjuste,
                            Status_geral: "Ajuste solicitado"
                        }, nomeR: globais.nomeRelPDC
                    });
                    // Aguarda a conclusão da atualização do registro
                    console.log("Vai atualizar o registro");
                    console.log("Botao:", botao);
                    console.log("ID do registro:", globais.idPDC);
                    console.log("Corpo:", {
                        Solicitacao_de_ajuste: textoAjuste,
                        Status_geral: "Ajuste solicitado"
                    });
                    console.log("Nome do relatório:", globais.nomeRelPDC);
                    const resultado = await executar_apiZoho({
                        tipo: "atualizar_reg", 
                        ID: globais.idPDC, 
                        corpo: {data:{
                                Solicitacao_de_ajuste: textoAjuste,
                                Status_geral: "Ajuste solicitado"
                            }
                        }, 
                        nomeR: globais.nomeRelPDC
                    });

                    // Verifica se a atualização foi bem-sucedida antes de redirecionar
                    if (resultado && resultado.code === 3000) {
                        console.log("Vai atualizar a página");
                        window.open(`${url}#Script:page.refresh`, '_top');
                    } else {
                        console.log("Erro =>", resultado);
                        throw new Error('Falha ao atualizar o registro');
                    }
                    break;

                case 'arquivar_cot':
                    await executar_apiZoho({
                        tipo: "atualizar_reg", ID: globais.idPDC, corpo: {
                            Status_geral: "Proposta arquivada"
                        }, nomeR: globais.nomeRelPDC
                    });
                    window.open(`${url}#Script:page.refresh`, '_top');
                    break;

                case 'remover_produto':
                    removeRow(botao);
                    break;

                case 'remover_fornecedor':
                    removeSupplierColumn(botao);
                    break;
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Ocorreu um erro ao processar a solicitação');
        } finally {
            overlay.remove();
        }
    });

    // Ação ao clicar em Cancelar
    cancelButton.addEventListener('click', function () {
        overlay.remove();
        popup.remove();
    });

    // Montar estrutura do modal
    popup.appendChild(messageElement);
    popup.appendChild(confirmButton);
    popup.appendChild(cancelButton);
    popup.appendChild(loadingElement);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}