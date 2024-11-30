import {globais} from './main.js';
import { customModal } from './utils.js';

export function criarBotao({page = null, removeExistingButtons = false})
{
    console.log("[ENTROU NA CRIAR BOTÃO]", page);

    if (page  !== null){
        //==========BUSCA O CONTAINER DOS BOTÕES, SE NECESSÁRIO, REMOVE OS BOTÕES EXISTENTES==========//
        const saveBtnContainer = document.querySelector('.save-btn-container');
        
        
        if(removeExistingButtons)//REMOVE TODOS OS BOTÕES DENTRO DA SEÇÃO DE BOTÕES
        {
            while (saveBtnContainer.firstChild) {
                saveBtnContainer.removeChild(saveBtnContainer.firstChild);
            }
        }

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
                if (page === "editar_cotacao") criarBotao({page: "arquivar_cotacao"});
                break;

            case "aprovar_cotacao":
                configurarBotao('approve-btn', 'Aprovar', "aprov_cot", "Aprovar proposta", "Tem certeza que deseja APROVAR a proposta do fornecedor selecionado?");
                criarBotao({page: "ajust_cot"});
                criarBotao({page: "arquivar_cotacao"});
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
                newButton.onclick = () => { /* lógica do modal */ };
                break;

            case "finalizar_provisionamento":
                configurarBotao('finalizar-provisionamento-btn adjust-btn', 'Finalizar Provisionamento', page, null, "Deseja realmente finalizar o provisionamento?\nPDC será enviado para realização da compra.");
                break;

            case "suspender_pagamento":
                configurarBotao('adjust-btn', 'Suspender', page, "Suspender Pagamento", "Tem certeza que deseja SUSPENDER o pagamento deste PDC?");
                break;

            default:
                if (tiposAssinatura.includes(page)) {
                    configurarBotao('approve-btn', 'Autorizar', page, "Autorizar Pagamento", "Tem certeza que deseja AUTORIZAR o pagamento deste PDC?");
                    criarBotao({page: "suspender_pagamento"});
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


