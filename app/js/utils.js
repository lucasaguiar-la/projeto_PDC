import { saveTableData } from './table_utils.js';
import { globais } from './main.js';

/**
 * Executa requisições para a API do Zoho Creator
 * 
 * @async
 * @function executar_apiZoho
 * @param {Object} params - Parâmetros da requisição
 * @param {string} [params.tipo] - Tipo de operação: "add_reg", "atualizar_reg", "busc_reg", "busc_reg_recursivo"
 * @param {string} [params.criterios] - Critérios de busca para operações de consulta
 * @param {string} [params.ID] - ID do registro para atualização
 * @param {Object} [params.corpo] - Dados para criação/atualização de registros
 * @param {string} [params.nomeR] - Nome do relatório (report) no Zoho
 * @param {string} [params.nomeF] - Nome do formulário no Zoho
 * @returns {Promise<Object>} Resultado da operação na API
 * 
 * @description
 * Esta função centraliza as operações com a API do Zoho Creator, permitindo:
 * - Buscar registros (simples ou recursivamente)
 * - Criar novos registros
 * - Atualizar registros existentes
 * - Buscar e armazenar dados de fornecedores
 * 
 * Funções internas:
 * - busc_reg: Busca registros com paginação
 * - criar_reg: Cria novo registro
 * - atualizar_reg: Atualiza registro existente
 * - buscarFornecedores: Popula o Map baseFornecedores
 * - buscarRecursivamente: Busca registros recursivamente com paginação
 */
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

        async function buscarRecursivamente(nomeR, criterio) {
            let baseApoio = new Map();
            let paginaAtual = 1;

            try {  
                while (true) {
                    const resp = await busc_reg(nomeR, criterio, paginaAtual);
                    
                    // Verifica se é a resposta de "nenhum registro encontrado" (código 3100)
                    if (resp && resp.code === 3100) {
                        break;
                    }
                    
                    // Verifica outras condições de parada
                    if (!resp || resp.code !== 3000 || !Array.isArray(resp.data) || resp.data.length === 0) {
                        break;
                    }

                    // Processa os dados recebidos
                    resp.data.forEach((item) => {
                        const id = item.ID || item.C_digo_da_classe_operacional;
                        baseApoio.set(id, item);
                    });

                    paginaAtual++;
                }
            } catch (err) {
                // Loga apenas erros que não sejam do tipo "nenhum registro encontrado"
                if (!err.responseText?.includes('"code":3100')) {
                    console.error("Erro ao buscar dados:", err);
                }
            }

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
        }
    } catch (err) {
        return err;
    }
}

/**
 * Formata valores numéricos para o formato de moeda brasileira (BRL)
 * 
 * @function formatToBRL
 * @param {string|number|HTMLElement} v - Valor ou elemento HTML a ser formatado
 * @returns {string|void} String formatada em BRL ou undefined se atualizar elemento HTML
 * 
 * @description
 * Esta função realiza as seguintes operações:
 * 1. Aceita strings, números ou elementos HTML como entrada
 * 2. Converte o valor para decimal usando converterStringParaDecimal()
 * 3. Trata números negativos preservando o sinal
 * 4. Formata o valor com separador de milhares (.) e decimais (,)
 * 5. Se receber elemento HTML, atualiza seu innerText
 * 6. Se receber string/número, retorna string formatada
 * 
 * @example
 * formatToBRL("1234.56") // retorna "1.234,56"
 * formatToBRL("-1234.56") // retorna "-1.234,56"
 * formatToBRL(elementoHTML) // atualiza o texto do elemento
 */
export function formatToBRL(v) {
    if(!v) return "0,00";

    let av; //Apoio ao valor
    let int = false; //Flag para inteiro
    let isNeg = false; //Flag para negativo

    // Ajuste para lidar com evento
    const elemento = v.target || v;

    if ((typeof elemento == "string" || typeof elemento == "number")) {
        av = converterStringParaDecimal(elemento);
    } else {
        av = elemento.innerText || elemento.value;
        int = elemento.classList?.contains("integer-cell") || false;
    }

    // Verifica se é negativo
    if (av.toString().startsWith('-')) {
        isNeg = true;
        av = av.toString().substring(1);
    }
    av = int ? av : converterStringParaDecimal(av);
    av = /[.,]/.test(av) || int ? av : `${av}00`;

    let avc = (av.toString().split('.')[1] || '').length == 1 ? (`${av}0`).replace(/[^0-9]/g, '') : av.toString().replace(/[^0-9]/g, '');

    let pi = (avc.slice(0, -2) || (int ? '' : '0')).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    let pd = avc.slice(-2);

    let vf = int ? `${pi}${pd}` : `${pi},${pd}`;
    
    // Adiciona o sinal negativo de volta se necessário
    if (isNeg) {
        vf = `-${vf}`;
    }
    if (v.innerText || v.value) {
        const target = 'value' in v ? 'value' : 'innerText';
        v[target] = vf;
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

/**
 * Converte um número positivo para negativo
 * 
 * @function convertToNegative
 * @param {number} v - Valor numérico a ser convertido
 * @returns {number} Valor convertido para negativo se positivo, ou mantém o valor se já for negativo
 */
export function convertToNegative(v) {
    return v > 0 ? (v * -1) : v;
}

/**
 * Restringe o conteúdo de células a apenas valores numéricos
 * 
 * @function restrictNumericInput
 * @param {HTMLElement} obj - Elemento HTML que contém o texto a ser filtrado
 * @description
 * - Remove todos os caracteres não numéricos, exceto pontos e vírgulas
 * - Atualiza o innerText do elemento com o valor filtrado
 */
export function restrictNumericInput(obj) {
    const input = obj.innerText;
    const filteredInput = input.replace(/[^0-9.,]/g, '');
    if (input !== filteredInput) {
        obj.innerText = filteredInput;
    }
}

/**
 * Restringe o conteúdo de células a apenas números inteiros
 * 
 * @function restrictIntegerInput
 * @param {Event|HTMLElement} event - Evento do DOM ou elemento HTML direto
 * @description
 * - Aceita tanto um evento quanto um elemento HTML direto
 * - Remove todos os caracteres não numéricos
 * - Atualiza o innerText do elemento com o valor filtrado
 */
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

/**
 * Converte um número para o formato brasileiro (0.000,00)
 * 
 * @function convertNumberFormat
 * @param {string|number} number - Número a ser formatado
 * @returns {string} Número formatado no padrão brasileiro ou string vazia em caso de erro
 * @description
 * - Remove formatação anterior de pontos e vírgulas
 * - Converte para número e formata com 2 casas decimais
 * - Retorna o valor formatado usando toLocaleString
 */
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

function createEl(tag, className = '', innerHTML = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
}


/**
 * Cria e exibe um modal customizado com diferentes funcionalidades
 * 
 * @async
 * @function customModal
 * @param {Object} params - Parâmetros de configuração do modal
 * @param {HTMLElement} [params.botao=null] - Botão que acionou o modal (opcional)
 * @param {string} params.tipo - Tipo do modal ('ajustar_cot', 'arquivar_cot', 'salvar_cot', etc)
 * @param {string} [params.titulo=null] - Título do modal (opcional)
 * @param {string} params.mensagem - Mensagem principal do modal
 * @param {string} [params.confirmText='Confirmar'] - Texto do botão de confirmação
 * @param {string} [params.cancelText='Cancelar'] - Texto do botão de cancelamento
 * @param {string} [params.loadingText='Carregando, aguarde...'] - Texto exibido durante carregamento
 * 
 * @description
 * Esta função cria um modal customizado com as seguintes características:
 * 
 * - Estrutura base:
 *   - Overlay que cobre a tela
 *   - Popup central com título (opcional)
 *   - Mensagem principal
 *   - Área de input (para tipos específicos)
 *   - Botões de confirmação e cancelamento
 *   - Indicador de carregamento
 * 
 * - Tipos de modal suportados:
 *   - ajustar_cot: Modal para solicitar ajustes na cotação
 *   - arquivar_cot: Modal para arquivar cotação
 *   - salvar_cot: Modal para salvar cotação
 * 
 * - Funcionalidades:
 *   - Validação de campos obrigatórios
 *   - Feedback visual de erros
 *   - Estado de carregamento durante operações
 *   - Integração com API Zoho para atualizações
 *   - Recarregamento da página após operações bem-sucedidas
 * 
 * @example
 * // Modal básico de confirmação
 * customModal({
 *   tipo: 'salvar_cot',
 *   mensagem: 'Deseja salvar as alterações?'
 * });
 * 
 * // Modal com input e título
 * customModal({
 *   tipo: 'ajustar_cot',
 *   titulo: 'Solicitar Ajuste',
 *   mensagem: 'Descreva o ajuste necessário:',
 *   confirmText: 'Enviar'
 * });
 */
export async function customModal({botao = null, tipo = null, titulo = null, mensagem,confirmText = 'Confirmar',cancelText = 'Cancelar',loadingText = 'Carregando, aguarde...'}) {
    
    if(tipo === null){
        tipo = 'editar_pdc';
    }

    // Criação da estrutura base
    const overlay = createEl('div', 'customConfirm-overlay-div');
    const popup = createEl('div', 'customConfirm-div');
    const messageElement = createEl('p', 'customConfirm-message', mensagem);
    // Cria o elemento de loading
    const loadingElement = createEl('div', 'customConfirm-loading', 
        `<div class="customConfirm-loading-spinner"></div> ${loadingText}`);

    // Adiciona título se fornecido
    if (titulo) {
        popup.appendChild(createEl('h3', 'customConfirm-title', titulo));
    }

    // Configuração do input para tipos específicos
    const inputConfig = {
        'ajustar_cot': {
            placeholder: 'Ex.: Gostaria que o valor de frete fosse alterado...',
            buttonClass: 'customAdjust-confirmButton'
        },
        'arquivar_cot': {
            placeholder: 'Ex.: Arquivo devido a não resposta do fornecedor...',
            buttonClass: 'customArchive-confirmButton'
        },
        'solicitar_ajuste_ao_compras': {
            placeholder: 'Ex.: Produto veio quebrado, não recebido...',
            buttonClass: 'customAdjust-confirmButton'
        }

    };

    // Adiciona input se necessário
    let inputElement;
    if (inputConfig[tipo]) {
        inputElement = createEl('textarea', 'customAdjust-textarea');
        inputElement.placeholder = inputConfig[tipo].placeholder;
        Object.assign(inputElement.style, {
            width: '300px',
            height: '100px',
            resize: 'none',
        });
    }

    // Criação dos botões
    const buttonContainer = createEl('div', 'customConfirm-button-container');
    const confirmButton = createEl('button', `customConfirm-confirmButton ${inputConfig[tipo]?.buttonClass || ''}`, confirmText);
    const cancelButton = createEl('button', 'customConfirm-cancelButton', cancelText);

    // Aplica estilo ao container dos botões
    Object.assign(buttonContainer.style, {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        marginTop: '20px'
    });

    // Adiciona os botões ao container
    buttonContainer.append(confirmButton, cancelButton);

    // Função para esconder/mostrar elementos
    const toggleElements = (show) => {
        // Esconde/mostra o título se existir
        const titleElement = popup.querySelector('.customConfirm-title');
        if (titleElement) titleElement.style.display = show ? 'block' : 'none';
        
        // Esconde/mostra a mensagem
        messageElement.style.display = show ? 'block' : 'none';
        
        // Esconde/mostra a textarea se existir
        if (inputElement) {
            inputElement.style.display = show ? 'block' : 'none';
        }
        
        // Esconde/mostra os botões
        buttonContainer.style.display = show ? 'flex' : 'none';
        
        // Esconde/mostra o loading (inverso dos outros elementos)
        loadingElement.style.display = show ? 'none' : 'flex';

        // Remove a mensagem de erro quando mostrar o loading
        const errorMessage = popup.querySelector('.customConfirm-error-message');
        if (errorMessage) {
            errorMessage.style.display = show ? 'block' : 'none';
        }
    };

    // Handlers dos botões
    const handleConfirm = async () => {
        if (inputElement && !inputElement.value.trim()) {
            // Remove mensagem de erro anterior se existir
            const existingError = popup.querySelector('.customConfirm-error-message');
            if (existingError) {
                existingError.remove();
            }

            const errorMessage = createEl('p', 'customConfirm-error-message', "Preencha o campo de observação...");
            // Inserir após o inputElement ao invés de antes
            inputElement.insertAdjacentElement('afterend', errorMessage);
            
            // Aplicar estilos mantendo o textarea centralizado
            Object.assign(inputElement.style, {
                width: '300px',
                height: '100px',
                resize: 'none',
                border: '1px solid #ff5a5a',
                borderRadius: '4px',
                transition: 'border 0.2s ease',
                margin: '0 auto',  // Mantém centralizado
                display: 'block'   // Garante que ocupe a linha inteira
            });

            Object.assign(errorMessage.style, {
                margin: '5px 0 0 0',
                fontSize: '10pt',
                color: '#ff5a5a',
                textAlign: 'center' // Centraliza o texto de erro
            });

            return;
        }

        const url = 'https://guillaumon.zohocreatorportal.com/';
        toggleElements(false);
        
        // Determina o payload baseado no tipo de ação
        let payload;

        // Mapeia os tipos de ação para os payloads correspondentes
        const payloadMap = {
            'solicitar_aprovacao_sindico': {
                Status_geral: 'Aguardando aprovação de uma proposta'
            },
            'ajustar_cot': {
                Status_geral: 'Ajuste solicitado',
                Solicitacao_de_ajuste: inputElement ? inputElement.value : null
            },
            'aprov_cot': {
                Status_geral: 'Proposta aprovada'
            },
            'arquivar_cot': {
                Status_geral: 'Proposta arquivada',
                motivo_arquivamento: inputElement ? inputElement.value : null
            },
            'finalizar_provisionamento':
            {
                Status_geral: 'Lançado no orçamento'
            },
            'confirmar_compra': {
                Status_geral: 'Compra realizada'
            },
            'confirmar_recebimento': {
                Status_geral: 'Recebimento confirmado'
            },
            'solicitar_ajuste_ao_compras': {
                Status_geral: 'Ajuste Solicitado Pelo Almoxarifado',
                Solicitacao_de_ajuste: inputElement ? inputElement.value : null
            },
            'enviar_p_checagem_final': {
                Status_geral: 'Enviado para checagem final'
            },
            'enviar_p_assinatura':
            {
                Status_geral:'Assinatura Confirmada Controladoria'
            },
            'autorizar_pagamento_sindico': {
                Status_geral: 'Assinatura Confirmada Sindico'
            },
            'autorizar_pagamento_subsindico': {
                Status_geral: 'Assinatura Confirmada Sub Sindico'
            },
            'confirmar_todas_as_assinaturas': {
                Status_geral: 'Autorizado para pagamento'
            }
        };

        // Verifica se o tipo está no mapa e cria o payload
        if (payloadMap[tipo]) {
            const tiposValidos = [
                "solicitar_aprovacao_sindico",
                "finalizar_provisionamento",
                "enviar_p_checagem_final",
                "enviar_p_assinatura"
            ];
            if (tiposValidos.includes(tipo)) 
            {
                await saveTableData({ tipo });
            }

            payload = { data: [payloadMap[tipo]] };

        } else if (tipo === 'salvar_cot' || tipo === 'editar_pdc') {

            toggleElements(false);
            try {
                await saveTableData({ tipo });

                window.open(`${url}#Script:page.refresh`, '_top');
                return;
            } catch (erro) {
                console.error('Erro ao salvar cotação:', erro);
                toggleElements(true);
                messageElement.innerHTML = 'Ocorreu um erro ao salvar a cotação. Tente novamente.';
                return;
            }
        } else if (tipo === 'remover_fornecedor' || tipo === 'remover_produto') {
            overlay.remove();
            return Promise.resolve(true);
        }

        try {
            const resposta = await executar_apiZoho({ 
                tipo: "atualizar_reg", 
                ID: globais.idPDC, 
                corpo: payload,
                nomeR: globais.nomeRelPDC
            });

            // Fecha o modal após sucesso
            if (resposta && resposta.code === 3000) {
                overlay.remove();
                if(tipo == "confirmar_compra")
                {

                    // Obtém o valor da entidade selecionada
                    const entidadeSelecionada = document.getElementById('entidade').value;
    
                    let link_layout;
                    // [LAYOUT]
                    if(entidadeSelecionada == "3938561000066182591")
                    {
                        link_layout= `${url}guillaumon/app-envio-de-notas-boletos-guillaumon/pdf/Laranj_layout_impressao_pedido?ID_entry=${globais.idPDC}&id_pdc=${globais.idPDC}&zc_PdfSize=A4&zc_FileName=${globais.numPDC}_Laranjeiras`;
                    }
                    else if(entidadeSelecionada == "3938561000066182595")
                    {
                        link_layout= `${url}guillaumon/app-envio-de-notas-boletos-guillaumon/pdf/AssociacaoServir_layout_impressao_pedido?ID_entry=${globais.idPDC}&id_pdc=${globais.idPDC}&zc_PdfSize=A4&zc_FileName=${globais.numPDC}_Ass_Servir`;
                    }
    
                    window.open(`${link_layout}`, '_blank', 'noopener,noreferrer');
                }
                // Opcional: recarregar a página ou atualizar a interface
                window.open(`${url}#Script:page.refresh`, '_top');
            } else {
                throw new Error('Falha na atualização');
            }
        } catch (erro) {
            console.error('Erro ao processar requisição:', erro);
            // Volta para o estado normal do modal em caso de erro
            toggleElements(true);
            // Opcional: mostrar mensagem de erro para o usuário
            messageElement.innerHTML = 'Ocorreu um erro ao processar sua solicitação. Tente novamente.';
        }
    };

    // Montagem final do popup
    popup.append(
        messageElement,
        ...(inputElement ? [inputElement] : []),
        buttonContainer,
        loadingElement
    );

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Retorna uma Promise que será resolvida quando o usuário interagir com o modal
    return new Promise((resolve) => {
        confirmButton.addEventListener('click', () => {
            handleConfirm().then(result => {
                resolve(result);
            });
        });
        cancelButton.addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });
    });
}

/**
 * Desabilita todos os elementos editáveis da página
 * 
 * @function desabilitarTodosElementosEditaveis
 * @description
 * Desabilita:
 * - Inputs, textareas e selects
 * - Elementos com contenteditable
 * - Botões
 * - Radio buttons e checkboxes
 * - Células de tabela editáveis
 */
export function desabilitarTodosElementosEditaveis() {
    // Desabilita inputs, textareas e selects
    const elementosFormulario = document.querySelectorAll('input, textarea, select');
    elementosFormulario.forEach(elemento => {

        if (!(elemento.classList.contains('num-pdc') && globais.pag === 'criar_numero_de_PDC')) {
            elemento.disabled = true;
            elemento.style.cursor = 'not-allowed';
        };
    });

    // Desabilita elementos com contenteditable
    const elementosEditaveis = document.querySelectorAll('[contenteditable="true"]');
    elementosEditaveis.forEach(elemento => {
        // Verifica se o elemento possui a classe 'campo-datas' e se globais.pag é 'criar_numero_de_PDC'
        elemento.contentEditable = false;
        elemento.style.cursor = 'not-allowed';
    });

    // Desabilita botões, exceto os dentro de save-button-container
    const botoes = document.querySelectorAll('button');
    botoes.forEach(botao => {
        if(globais.pag === "ver_cotacao" || globais.pag === "ver_proposta_ganha") {
            if (!botao.classList.contains('toggle-section')) { // Verifica se o botão não tem a classe 'toggle-section'
                botao.disabled = true;
                botao.style.display = 'none';
            }
        } else
        {
            if (!botao.closest('.save-btn-container') && !botao.classList.contains('toggle-section')) {
                botao.disabled = true;
                botao.style.display = 'none';
            }
        }
    });

    // Remove event listeners de células de tabela
    const celulasDaTabela = document.querySelectorAll('td, th');
    celulasDaTabela.forEach(celula => {
        celula.style.pointerEvents = 'none';
        celula.style.cursor = 'not-allowed';
    });

    // Desabilita links
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        link.style.pointerEvents = 'none';
        link.style.cursor = 'not-allowed';
    });
}


