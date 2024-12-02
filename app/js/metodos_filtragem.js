import {globais} from './main.js';
import { customModal } from './utils.js';

export function criarBotao({page = null, removeExistingButtons = false})
{
    console.log("[ENTROU NA CRIAR BOTÃO]", page);
    //==========BUSCA O CONTAINER DOS BOTÕES, SE NECESSÁRIO, REMOVE OS BOTÕES EXISTENTES==========//
    const saveBtnContainer = document.querySelector('.save-btn-container');
        
    if(removeExistingButtons)//REMOVE TODOS OS BOTÕES DENTRO DA SEÇÃO DE BOTÕES
    {
        while (saveBtnContainer.firstChild) {
            saveBtnContainer.removeChild(saveBtnContainer.firstChild);
        }
    }

    if (page  !== null){
        //==========CRIA O NOVO BOTÃO SOLICITADO=========//
        const newButton = document.createElement('button');
        let type = page;
        let title = null;
        let message;

        const tiposAssinatura = ["autorizar_pagamento_subsindico", "autorizar_pagamento_sindico", "confirmar_todas_as_assinaturas"];

        // Função para configurar o botão
        const configurarBotao = (classe, texto, tipo, titulo, msg) => {
            newButton.className = classe;
            newButton.textContent = texto;
            type = tipo;
            title = titulo;
            message = msg;
        };

        // Configurações de botões baseadas na página
        switch (page) {
            case "criar_cotacao":
            case "editar_cotacao":
                configurarBotao('approve-sindico-btn adjust-btn', 'Sol. Aprov. Síndico', "solicitar_aprovacao_sindico", null, "Deseja solicitar a aprovação do síndico?");
                if (page === "editar_cotacao") setTimeout(() => criarBotao({page: "arquivar_cotacao"}), 0);
                break;

            case "aprovar_cotacao":
                configurarBotao('approve-btn', 'Aprovar', "aprov_cot", "Aprovar proposta", "Tem certeza que deseja APROVAR a proposta do fornecedor selecionado?");
                setTimeout(() => criarBotao({page: "ajustar_cotacao"}), 0);
                setTimeout(() => criarBotao({page: "arquivar_cotacao"}), 0);
                break;

            case "ajustar_cotacao":
                configurarBotao('adjust-btn', 'Solicitar Ajuste', "ajustar_cot", "Solicitação de Ajuste", "Por favor, descreva abaixo o ajuste que deseja fazer:");
                break;

            case "arquivar_cotacao":
                configurarBotao('archive-btn', 'Arquivar', "arquivar_cot", "Arquivar", "Você tem certeza de que deseja arquivar este registro?");
                break;

            case "confirmar_compra":
                configurarBotao('confirm-purchase-btn adjust-btn', 'Confirmar compra', page, null, "Deseja marcar essa solicitação como COMPRADA?");
                break;

            case "criar_numero_de_PDC":
                configurarBotao('criar-pdc-btn adjust-btn', 'Criar PDC', null, null, null);

                if(globais.numPDC)
                {
                    newButton.disabled = true;
                    newButton.classList.add('disabled');
    
                    const allSections = document.querySelectorAll('.section');
                    allSections.forEach(section => {
                        const header = section.previousElementSibling; // Seleciona o header correspondente
                        if (!section.classList.contains('form-pagamento') && !section.classList.contains('section-buttons')) { // Verifica se não é a seção de parcelas e não é a seção de botões
                            section.classList.add('collapsed'); // Adiciona a classe para colapsar
                            if (header && header.classList.contains('section-header')) {
                                header.classList.add('collapsed'); // Adiciona a classe para a setinha
                            }
                        }
                    });
                    setTimeout(() => criarBotao({page: "finalizar_provisionamento", removeExistingButtons:false}), 0);
                }else
                {
                    newButton.onclick = () => {
                        //Abre modal em popup
                        const overlay = document.createElement('div');
                        overlay.className = 'customConfirm-overlay-div'; //Classe para o overlay
                        const popup = document.createElement('div');
                        popup.className = 'customConfirm-div'; //Classe para o popup
        
                        //CRIA O LAYOUT DO POPUP COM O CAMPO DE PREENCHER O PDC//
                        const title = document.createElement('h3');
                        title.className = 'customConfirm-title';
                        title.textContent = 'Inserir Número do PDC';
        
                        const label = document.createElement('label');
                        label.setAttribute('for', 'numeroPDC');
                        label.textContent = 'Número do PDC:';
        
                        const input = document.createElement('input');
                        input.type = 'number';
                        input.id = 'numeroPDC';
                        input.name = 'numeroPDC';
        
                        const buttonContainer = document.createElement('div');
                        buttonContainer.className = 'customConfirm-button-container';
        
                        const salvarButton = document.createElement('button');
                        salvarButton.id = 'salvarPDC';
                        salvarButton.className = 'customConfirm-confirmButton';
                        salvarButton.textContent = 'Salvar';
        
                        const fecharButton = document.createElement('button');
                        fecharButton.id = 'fecharModal';
                        fecharButton.className = 'customConfirm-cancelButton';
                        fecharButton.textContent = 'Fechar';
        
                        buttonContainer.appendChild(salvarButton);
                        buttonContainer.appendChild(fecharButton);
                        popup.appendChild(title);
                        popup.appendChild(label);
                        popup.appendChild(input);
                        popup.appendChild(buttonContainer);
        
                        overlay.appendChild(popup);
                        document.body.appendChild(overlay);
        
                        // Função para salvar o número do PDC
                        salvarButton.onclick = function () {
                            const numeroPDC = document.getElementById('numeroPDC').value;
                            const parcelas = document.querySelectorAll('#camposData .parcela');
                            parcelas.forEach((parcela, index) => {
                                const pdcValue = parcelas.length > 1 ? `${numeroPDC}/${String(index + 1).padStart(2, '0')}` : numeroPDC;
                                const inputPDC = document.createElement('input');
                                inputPDC.classList.add("campo-datas");
                                inputPDC.type = 'text';
                                inputPDC.value = pdcValue;
                                inputPDC.contentEditable = true; // Campo somente leitura
                                inputPDC.name = 'Num_PDC_parcela';
                                parcela.appendChild(inputPDC); // Adiciona o campo na parcela
                            });
                            overlay.remove(); // Fecha o modal
                            
                            // Desabilita o botão de criar PDC
                            newButton.disabled = true;
                            newButton.classList.add('disabled'); // Adiciona a classe para estilo visual
                            
                            // Adiciona o novo botão após o botão "Criar PDC"
                            setTimeout(() => criarBotao({page: "finalizar_provisionamento", removeExistingButtons:false}), 0);
        
                            // Oculta todas as seções, exceto a seção de parcelas
                            const allSections = document.querySelectorAll('.section');
                            allSections.forEach(section => {
                                const header = section.previousElementSibling; // Seleciona o header correspondente
                                if (!section.classList.contains('form-pagamento') && !section.classList.contains('section-buttons')) { // Verifica se não é a seção de parcelas e não é a seção de botões
                                    section.classList.add('collapsed'); // Adiciona a classe para colapsar
                                    if (header && header.classList.contains('section-header')) {
                                        header.classList.add('collapsed'); // Adiciona a classe para a setinha
                                    }
                                }
                            });
                        };
                        // Função para fechar o modal
                        document.getElementById('fecharModal').onclick = function () {
                            overlay.remove();
                        };
    
                    }
                }
                break;

            case "finalizar_provisionamento":
                configurarBotao('finalizar-provisionamento-btn adjust-btn', 'Finalizar Provisionamento', page, null, "Deseja realmente finalizar o provisionamento?\nPDC será enviado para realização da compra.");
                break;

            case "receber_compra":
                configurarBotao('confirm-purchase-btn approve-btn', 'Confirmar recebimento', page, null, "Deseja confirmar o RECEBIMENTO dessa compra?");
                setTimeout(() => criarBotao({page: "solicitar_ajuste_ao_compras"}));
                break;

            case "solicitar_ajuste_ao_compras":
                configurarBotao('confirm-purchase-btn adjust-btn', 'Solicitar ajuste', page, null, 'Deseja solicitar o AJUSTE deste PDC?');
                break;
            
            case "ajustar_compra_compras":
                configurarBotao('confirm-purchase-btn adjust-btn', 'Enviar p/ checagem final', 'enviar_p_assinatura', null, 'Deseja enviar o PDC para que o SÍNDICO e o SUBSÍNDICO possa autorizar?');
                //setTimeout(() => criarBotao({page: "arquivar_cotacao"}));
                break;
            
            case "checagem_final":
                configurarBotao('confirm-purchase-btn adjust-btn', 'Sol. aut. Síndico', 'enviar_p_checagem_final', null, 'Deseja enviar o PDC para a CHECAGEM FINAL da controladoria?');
                break;

            case "suspender_pagamento":
                configurarBotao('adjust-btn', 'Suspender', page, "Suspender Pagamento", "Tem certeza que deseja SUSPENDER o pagamento deste PDC?");
                break;

            default:
                if (tiposAssinatura.includes(page)) {
                    configurarBotao('approve-btn', 'Autorizar', page, "Autorizar Pagamento", "Tem certeza que deseja AUTORIZAR o pagamento deste PDC?");
                    setTimeout(() => criarBotao({page: "suspender_pagamento"}), 0);
                }
                break;
        }

        //==========SE O BOTÃO NÃO FOR UMA EXCEÇÃO, CRIA O ONCLICK PARA ABRIR UM MODAL DE CONFIRMAÇÃO==========//
        if (!["criar_numero_de_PDC"].includes(page)) {
            newButton.onclick = () => {
                customModal({botão: this, tipo: type, titulo: title, mensagem: message});
            };
        }

        //==========ADICIONA O BOTÃO CRIADO NO CONTEINER DOS BOTÕES==========//
        saveBtnContainer.appendChild(newButton);

    }
}


