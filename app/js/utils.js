import { globais } from './main.js';
import { prenchTabCot, saveTableData, preencherDadosPDC, autalizarOuvintesTabCot, removeSupplierColumn, removeRow } from './table_utils.js'

export let baseFornecedores = new Map();

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

    //=====BUSCA O PLANO DE CONTAS=====//
    /*
    console.log("[BUSCANDO PLANO DE CONTAS]");
    let cPlanContas = "(ID!=0)";
    console.log(globais.nomeRelPlanContas);
    const planContas = await executar_apiZoho({tipo: "busc_reg", criterios: cPlanContas, nomeR: globais.nomeRelPlanoContas});
    console.log(JSON.stringify(planContas));
    console.log("[FIM BUSCANDO PLANO DE CONTAS]");
    */

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
                customConfirm(this, "aprov_cot", "Aprovar proposta", "Tem certeza que deseja APROVAR a proposta do fornecedor selecionado?");
            };

            // Cria o botão "Solicitar Ajuste"
            const adjustButton = document.createElement('button');
            adjustButton.className = 'adjust-btn';
            adjustButton.textContent = 'Solicitar Ajuste';
            adjustButton.onclick = function () {
                customAdjust(this, "ajuste", "Solicitação de Ajuste", "Por favor, descreva abaixo o ajuste que deseja fazer:");
            };

            // Cria o botão "Arquivar"
            const archiveButton = document.createElement('button');
            archiveButton.className = 'archive-btn';
            archiveButton.textContent = 'Arquivar';
            archiveButton.onclick = function () {
                customArchive(this, "arquivar", "Arquivar", "Você tem certeza de que deseja arquivar este registro?");
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

//===========================Executar quaisquer requisições do zoho===========================//
export async function executar_apiZoho({ tipo = null, criterios = null, ID = null, corpo = null, nomeR = null, nomeF = null } = {}) {
    try {
        nomeR = nomeR ? nomeR : globais.nomeRelCot;
        nomeF = nomeF ? nomeF : globais.nomeFormCot;
        await ZOHO.CREATOR.init();
        let recOps = await ZOHO.CREATOR.API;

        // Função de buscar registro
        async function busc_reg(nomeR, criterio, numPag) {
            ;
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

            return recOps.updateRecord({
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

        // Funções solicitadas conforme tipo
        if (tipo === "add_reg") {

            return await criar_reg(corpo);
        } else if (tipo === "atualizar_reg") {

            return await atualizar_reg(nomeR, ID, corpo);
        } else if (tipo === "busc_reg") {

            return await busc_reg(nomeR, criterios, 1);
        } else {
            buscarFornecedores();
        }
    } catch (err) {
        return err;
    }
}

//=====Formata as células de valores para o formato BRL=====//
export function formatToBRL(v) {
    let cell = undefined;
    let av;
    let int = false;
    let isNegative = false;

    if ((typeof v == "string" || typeof v == "number") && v !== "") {
        av = parseFloat(v);
        let f = Math.pow(10, 2);
        av = (Math.round(av * f) / f).toString();
    } else {
        av = v.innerText;
        int = v.classList.contains("integer-cell");
    }

    // Verifica se é negativo
    if (av.toString().startsWith('-')) {
        isNegative = true;
        av = av.toString().substring(1);
    }

    av = int ? av : converterParaDecimal(av);
    av = /[.,]/.test(av) || int ? av : `${av}00`;

    let avc = (av.toString().split('.')[1] || '').length == 1 ? (`${av}0`).replace(/[^0-9]/g, '') : av.toString().replace(/[^0-9]/g, '');

    let pi = (avc.slice(0, -2) || (int ? '' : '0')).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    let pd = avc.slice(-2);

    let vf = int ? `${pi}${pd}` : `${pi},${pd}`;
    
    // Adiciona o sinal negativo de volta se necessário
    if (isNegative) {
        vf = `-${vf}`;
    }

    if (v.innerText) {
        v.innerText = vf;
        return;
    } else {
        return vf;
    }
}

export function converterParaDecimal(v) {
    let cell = undefined;
    let av;
    let isNegative = false;

    if (typeof v == "string" || typeof v == "number") {
        av = v.toString().trim();
    } else {
        av = v.innerText.trim();
        cell = v.target;
    }

    // Verifica se é negativo
    if (av.startsWith('-')) {
        isNegative = true;
        av = av.substring(1);
    }

    av = (av.split('.')[1] || '').length == 1 ? `${av}0` : av;
    av = (av.split(',')[1] || '').length == 1 ? `${av}0` : av;

    av = /[.,]/.test(av) ? av : `${av}00`;

    let avc = av.replace(/[^0-9]/g, '');
    let pi = avc.slice(0, -2) || '0';
    let pd = avc.slice(-2);

    // Monta o número formatado em decimal
    let vf = parseFloat(`${pi}.${pd}`);

    // Aplica o sinal negativo se necessário
    if (isNegative) {
        vf = -vf;
    }

    if (cell) {
        cell.innerText = vf;
        return;
    } else {
        return vf;
    }
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
export function restrictIntegerInput(obj) {
    const input = obj.innerText;
    const filteredInput = input.replace(/[^0-9]/g, '');
    if (input !== filteredInput) {
        obj.innerText = filteredInput;
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
export async function customModal(botao = null, tipo, titulo, mensagem) {
    console.log('[ENTROU NO CUSTOM BUTTON]');

    // Criação do overlay
    const overlay = document.createElement('div');
    overlay.classList.add('customConfirm-overlay-div');

    // Criação da janela do popup
    const popup = document.createElement('div');
    popup.classList.add('customConfirm-div');

    // Título
    const titleElement = document.createElement('h3');
    titleElement.classList.add('customConfirm-title');
    titleElement.textContent = titulo;

    // Mensagem
    const messageElement = document.createElement('p');
    messageElement.textContent = mensagem;
    messageElement.classList.add('customConfirm-message');

    // Botão Confirmar
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirmar';
    confirmButton.classList.add('customConfirm-confirmButton');

    // Adiciona classe específica baseada no tipo e campo de texto
    if (tipo === 'ajustar_cot') {
        // CLasse do botão
        confirmButton.classList.add('customAdjust-confirmButton');
        // Campo de texto para ajuste
        inputElement = document.createElement('textarea');
        inputElement.classList.add('customAdjust-textarea');
        inputElement.placeholder = 'Ex.: Gostaria que o valor de frete fosse alterado...';
        popup.appendChild(inputElement);
    } else if (tipo === 'arquivar_cot') {
        // CLasse do botão
        confirmButton.classList.add('customArchive-confirmButton');
        // Campo de texto para motivo da arquivação
        inputElement = document.createElement('textarea');
        inputElement.classList.add('customAdjust-textarea');
        inputElement.placeholder = 'Ex.: Arquivo devido a não resposta do fornecedor...';
        popup.appendChild(inputElement);
    }

    // Botão Cancelar
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar';
    cancelButton.classList.add('customConfirm-cancelButton');

    // Elemento de carregamento
    const loadingElement = document.createElement('div');
    loadingElement.classList.add('customConfirm-loading');
    loadingElement.innerHTML = '<div class="customConfirm-loading-spinner"></div> Carregando, aguarde...';

    // Ação ao clicar em Confirmar
    confirmButton.addEventListener('click', async function () {
        // Esconde os botões e a mensagem original, exibe o carregamento
        const elementsToHide = [confirmButton, cancelButton, titleElement, messageElement];
        if (inputElement) elementsToHide.push(inputElement);
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
                    await executar_apiZoho({
                        tipo: "atualizar_reg", ID: botao.dataset.idRegistro, corpo: {
                            Solicitacao_de_ajuste: textoAjuste,
                            Status_geral: "Ajuste solicitado"
                        }, nomeR: globais.nomeRelPDC
                    });
                    window.open(`${url}#Script:page.close`, '_top');
                    break;

                case 'arquivar_cot':
                    await executar_apiZoho({
                        tipo: "atualizar_reg", ID: botao.dataset.idRegistro, corpo: {
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
    popup.appendChild(titleElement);
    popup.appendChild(messageElement);
    popup.appendChild(confirmButton);
    popup.appendChild(cancelButton);
    popup.appendChild(loadingElement);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

/*
export function customConfirm(botao, tipo, titulo, mensagem) {
    console.log('[ENTROU NO CUSTOM CONFIRM]');
     // Criação do overlay
    const overlay = document.createElement('div');
    overlay.classList.add('customConfirm-overlay-div');

     // Criação da janela do popup
    const popup = document.createElement('div');
    popup.classList.add('customConfirm-div');

     // Título
    const titleElement = document.createElement('h3');
    titleElement.classList.add('customConfirm-title');
    titleElement.textContent = titulo;
    
     // Mensagem
    const messageElement = document.createElement('p');
    messageElement.textContent = mensagem;
    messageElement.classList.add('customConfirm-message');

     // Botão Confirmar
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirmar';
    confirmButton.classList.add('customConfirm-confirmButton');

     // Botão Cancelar
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar';
    cancelButton.classList.add('customConfirm-cancelButton');

     // Elemento de carregamento
    const loadingElement = document.createElement('div');
    loadingElement.classList.add('customConfirm-loading');
    loadingElement.innerHTML = '<div class="customConfirm-loading-spinner"></div> Carregando, aguarde...';

     // Ação ao clicar em Confirmar
    confirmButton.addEventListener('click', function() {
             // Esconde os botões e a mensagem original, exibe o carregamento
            confirmButton.style.display = 'none';
            cancelButton.style.display = 'none';
            titleElement.style.display = 'none';
            messageElement.style.display = 'none';
             loadingElement.style.display = 'flex'; // Exibe o "Carregando, aguarde..."
        if (tipo === 'salvar_cot') {

             // Executa a função com o await
            async function executar() {
                await saveTableData();
                window.open('https://guillaumon.zohocreatorportal.com/#Script:page.refresh', '_top');
            }

             // Chama a função com atraso para simular carregamento
            executar().then(() => {
                 document.body.removeChild(overlay); // Fecha o popup
            });
        }else if(tipo === 'aprov_cot')
        {
             // Executa a função com o await
            async function executar() {
                await saveTableData();
                window.open('https://guillaumon.zohocreatorportal.com/#Script:dialog.close', '_top');
            }
        }else if (tipo === 'ajuste' && textoAjuste != "") {
            // Esconde os botões e a mensagem original, exibe o carregamento
            confirmButton.style.display = 'none';
            cancelButton.style.display = 'none';
            titleElement.style.display = 'none';
            messageElement.style.display = 'none';
            inputElement.style.display = 'none';
            loadingElement.style.display = 'flex';

            // Função para salvar o ajuste no Zoho Creator
            async function executar() {
                const payload = {
                    data: {
                        Solicitacao_de_ajuste: textoAjuste,
                        Status_geral: "Ajuste solicitado"
                    }
                };

                const registroID = botao.dataset.idRegistro; // Obtém o ID do registro a partir do botão

                // Função para atualizar o registro no Zoho
                respAjuste = await executar_apiZoho({ tipo: "atualizar_reg", ID: registroID, corpo: payload,  nomeR: "Laranj_PDC_Digital_ADM"});
                if (respAjuste) {
                    console.log("Ajuste salvo no Zoho Creator:", textoAjuste);
                    window.open('https://creatorapp.zoho.com/guillaumon/app-envio-de-notas-boletos-guillaumon/#Script:page.close', '_top');
                }

                // Fechar o popup
                document.body.removeChild(overlay);
            }
            // Chama a função para salvar o ajuste
            executar();
        }else if (tipo === 'arquivar') {
            // Esconde os botões e a mensagem original, exibe o carregamento
            confirmButton.style.display = 'none';
            cancelButton.style.display = 'none';
            titleElement.style.display = 'none';
            messageElement.style.display = 'none';
            loadingElement.style.display = 'flex';

            // Função para arquivar a proposta no Zoho Creator
            async function executar() {
                const payload = {
                    data: {
                        Status_geral: "Proposta arquivada"
                    }
                };

                //const registroID = botao.dataset.idRegistro; // Obtém o ID do registro a partir do botão

                // Função para atualizar o registro no Zoho
                const respArquivo = await executar_apiZoho({ tipo: "atualizar_reg", ID: registroID, corpo: payload, nomeR: "Laranj_PDC_Digital_ADM" });
                if (respArquivo) {
                    console.log("Proposta arquivada no Zoho Creator");
                    window.open('https://creatorapp.zoho.com/guillaumon/app-envio-de-notas-boletos-guillaumon/#Script:page.refresh', '_top');
                }

                // Fechar o popup
                document.body.removeChild(overlay);
            }
            // Chama a função para arquivar a proposta
            executar();
        }else {
            alert("Por favor, preencha o campo de ajuste.");
        }
    });

     // Ação ao clicar em Cancelar
    cancelButton.addEventListener('click', function() {
         document.body.removeChild(overlay); // Fecha o popup
    });

     // Montagem do popup
    popup.appendChild(titleElement);
    popup.appendChild(messageElement);
    popup.appendChild(confirmButton);
    popup.appendChild(cancelButton);
     popup.appendChild(loadingElement); // Adiciona o elemento de carregamento, inicialmente oculto
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    /*
    if(globais.pag = 'criar_cotacao')
    {

    }else if(globais.pag = 'aprovar_cotacao')
    {

        // Criação do overlay
        const overlay = document.createElement('div');
        overlay.classList.add('customConfirm-overlay-div');

        // Criação da janela do popup
        const popup = document.createElement('div');
        popup.classList.add('customConfirm-div');

        // Título
        const titleElement = document.createElement('h3');
        titleElement.classList.add('customConfirm-title');
        titleElement.textContent = titulo;
        
        // Mensagem
        const messageElement = document.createElement('p');
        messageElement.textContent = mensagem;
        messageElement.classList.add('customConfirm-message');

        // Container dos botões
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('customConfirm-buttonContainer');

        // Botão Confirmar
        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Confirmar';
        confirmButton.classList.add('customConfirm-confirmButton');
        buttonContainer.appendChild(confirmButton);

        // Botão Cancelar
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancelar';
        cancelButton.classList.add('customConfirm-cancelButton');
        buttonContainer.appendChild(cancelButton);

        // Elemento de carregamento
        const loadingElement = document.createElement('div');
        loadingElement.classList.add('customConfirm-loading');
        loadingElement.innerHTML = '<div class="customConfirm-loading-spinner"></div> Carregando, aguarde...';

        // Ação ao clicar em Confirmar
        confirmButton.addEventListener('click', function() {
            if (tipo === 'cotação') {
                // Esconde os botões e a mensagem original, exibe o carregamento
                confirmButton.style.display = 'none';
                cancelButton.style.display = 'none';
                titleElement.style.display = 'none';
                messageElement.style.display = 'none';
                loadingElement.style.display = 'flex'; // Exibe o "Carregando, aguarde..."

                // Executa a função com o await
                async function executar() {
                    await saveTableData();
                    window.open('https://creatorapp.zoho.com/guillaumon/app-envio-de-notas-boletos-guillaumon/#Script:page.refresh', '_top');

                    //const urlAtual = window.location.href;
                    //history.pushState({}, '', urlAtual);
                    //window.history.go(-1);
                }

                // Chama a função com atraso para simular carregamento
                executar().then(() => {
                    document.body.removeChild(overlay); // Fecha o popup
                });
            }
        });

        // Ação ao clicar em Cancelar
        cancelButton.addEventListener('click', function() {
            document.body.removeChild(overlay); // Fecha o popup
        });

        // Montagem do popup
        popup.appendChild(titleElement);
        popup.appendChild(messageElement);
        popup.appendChild(buttonContainer);
        popup.appendChild(loadingElement); // Adiciona o elemento de carregamento, inicialmente oculto
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
    }
}
function customAdjust(botao, tipo, titulo, mensagem){
    console.log("[ACIONOU O BOTÃO DE AJUSTE]");

    // Criação do overlay
    const overlay = document.createElement('div');
    overlay.classList.add('customAdjust-overlay-div');

    // Criação da janela do popup
    const popup = document.createElement('div');
    popup.classList.add('customAdjust-div');

    // Título
    const titleElement = document.createElement('h3');
    titleElement.classList.add('customAdjust-title');
    titleElement.textContent = titulo;

    // Mensagem
    const messageElement = document.createElement('p');
    messageElement.textContent = mensagem;
    messageElement.classList.add('customAdjust-message');

    // Container dos botões
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('customConfirm-buttonContainer');

    // Campo de texto para inserir ajuste
    const inputElement = document.createElement('textarea');
    inputElement.classList.add('customAdjust-textarea');
    inputElement.placeholder = 'Ex.: Gostaria que o valor de frete fosse alterado...';

    // Botão Confirmar
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirmar';
    confirmButton.classList.add('customAdjust-confirmButton');
    buttonContainer.appendChild(confirmButton);

    // Botão Cancelar
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar';
    cancelButton.classList.add('customAdjust-cancelButton');
    buttonContainer.appendChild(cancelButton);

    // Elemento de carregamento
    const loadingElement = document.createElement('div');
    loadingElement.classList.add('customConfirm-loading');
    loadingElement.innerHTML = '<div class="customConfirm-loading-spinner"></div> Carregando, aguarde...';

    // Ação ao clicar em Confirmar
    confirmButton.addEventListener('click', function() {
        const textoAjuste = inputElement.value.trim(); // Pega o valor do campo de texto

        if (tipo === 'ajuste' && textoAjuste != "") {
            // Esconde os botões e a mensagem original, exibe o carregamento
            confirmButton.style.display = 'none';
            cancelButton.style.display = 'none';
            titleElement.style.display = 'none';
            messageElement.style.display = 'none';
            inputElement.style.display = 'none';
            loadingElement.style.display = 'flex';

            // Função para salvar o ajuste no Zoho Creator
            async function executar() {
                const payload = {
                    data: {
                        Solicitacao_de_ajuste: textoAjuste,
                        Status_geral: "Ajuste solicitado"
                    }
                };

                const registroID = botao.dataset.idRegistro; // Obtém o ID do registro a partir do botão

                // Função para atualizar o registro no Zoho
                respAjuste = await executar_apiZoho({ tipo: "atualizar_reg", ID: registroID, corpo: payload,  nomeR: "Laranj_PDC_Digital_ADM"});
                if (respAjuste) {
                    console.log("Ajuste salvo no Zoho Creator:", textoAjuste);
                    window.open('https://creatorapp.zoho.com/guillaumon/app-envio-de-notas-boletos-guillaumon/#Script:page.close', '_top');
                }

                // Fechar o popup
                document.body.removeChild(overlay);
            }
            // Chama a função para salvar o ajuste
            executar();
        } else {
            alert("Por favor, preencha o campo de ajuste.");
        }
    });

    // Ação ao clicar em Cancelar
    cancelButton.addEventListener('click', function() {
        console.log('Ação cancelada');
        document.body.removeChild(overlay); // Fecha o popup
    });

    // Montagem do popup
    popup.appendChild(titleElement);
    popup.appendChild(messageElement);
    popup.appendChild(inputElement);
    popup.appendChild(buttonContainer);
    popup.appendChild(loadingElement);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

function customArchive(botao, tipo, titulo, mensagem) {
    console.log("[ACIONOU O BOTÃO DE ARQUIVAR]");

    // Criação do overlay
    const overlay = document.createElement('div');
    overlay.classList.add('customArchive-overlay-div');

    // Criação da janela do popup
    const popup = document.createElement('div');
    popup.classList.add('customArchive-div');

    // Título
    const titleElement = document.createElement('h3');
    titleElement.classList.add('customArchive-title');
    titleElement.textContent = titulo;

    // Mensagem
    const messageElement = document.createElement('p');
    messageElement.textContent = mensagem;
    messageElement.classList.add('customArchive-message');

    // Container dos botões
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('customConfirm-buttonContainer');

    // Botão Confirmar
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirmar';
    confirmButton.classList.add('customArchive-confirmButton');
    buttonContainer.appendChild(confirmButton)

    // Botão Cancelar
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar';
    cancelButton.classList.add('customArchive-cancelButton');
    buttonContainer.appendChild(cancelButton)

    // Elemento de carregamento
    const loadingElement = document.createElement('div');
    loadingElement.classList.add('customConfirm-loading');
    loadingElement.innerHTML = '<div class="customConfirm-loading-spinner"></div> Carregando, aguarde...';

    // Ação ao clicar em Confirmar
    confirmButton.addEventListener('click', function() {
        if (tipo === 'arquivar') {
            // Esconde os botões e a mensagem original, exibe o carregamento
            confirmButton.style.display = 'none';
            cancelButton.style.display = 'none';
            titleElement.style.display = 'none';
            messageElement.style.display = 'none';
            loadingElement.style.display = 'flex';

            // Função para arquivar a proposta no Zoho Creator
            async function executar() {
                const payload = {
                    data: {
                        Status_geral: "Proposta arquivada"
                    }
                };

                //const registroID = botao.dataset.idRegistro; // Obtém o ID do registro a partir do botão

                // Função para atualizar o registro no Zoho
                const respArquivo = await executar_apiZoho({ tipo: "atualizar_reg", ID: registroID, corpo: payload, nomeR: "Laranj_PDC_Digital_ADM" });
                if (respArquivo) {
                    console.log("Proposta arquivada no Zoho Creator");
                    window.open('https://creatorapp.zoho.com/guillaumon/app-envio-de-notas-boletos-guillaumon/#Script:page.refresh', '_top');
                }

                // Fechar o popup
                document.body.removeChild(overlay);
            }
            // Chama a função para arquivar a proposta
            executar();
        }
    });

    // Ação ao clicar em Cancelar
    cancelButton.addEventListener('click', function() {
        console.log('Ação cancelada');
        document.body.removeChild(overlay); // Fecha o popup
    });

    // Montagem do popup
    popup.appendChild(titleElement);
    popup.appendChild(messageElement);
    popup.appendChild(buttonContainer);
    popup.appendChild(loadingElement);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}
*/