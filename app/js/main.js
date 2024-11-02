import {addProductRow, addSupplierColumn} from './table_utils.js'
import {executarProcessosInicias, customModal } from './utils.js'

const _nomeApp = "app-envio-de-notas-boletos-guillaumon";

const _nomeFormCot = "cotacao_Laranjeiras";
const _nomeRelCot = "cotacao_Laranjeiras_Report";

const _nomeFormPDC = "PDC_Digital";
const _nomeRelPDC = "Laranj_PDC_Digital_ADM";

const _nomeFormPlanoContas = "Classe_operacional";
const _nomeRelPlanoContas = "Classe_operacional_Report";

class Globais {
    constructor() {
        this.state = {
            nomeApp: _nomeApp,
            nomeFormCot: _nomeFormCot,
            nomeRelCot: _nomeRelCot,
            nomeFormPDC: _nomeFormPDC,
            nomeRelPDC: _nomeRelPDC,
            nomeFormPlanoContas: _nomeFormPlanoContas,
            nomeRelPlanoContas: _nomeRelPlanoContas,
            numPDC: null,
            numPDC_temp: null,
            cotacaoExiste: false,
            idProduto: 2,
            pag: 'criar_cotacao'
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

//==========Ativa um listener qua aguarda a atualização da planilha==========//
document.addEventListener('DOMContentLoaded', () => {

   //=====Mapeia as classes dos botões às suas respectivas funções=====//
    const buttonActions = {
        "add-supplier-btn": () => addSupplierColumn(),
        "remove-supplier-btn": (elemento) => customModal({botao: elemento, tipo: 'remover_fornecedor'}),
        "add-product-btn": () => addProductRow(),
        "remove-product-btn": (elemento) => customModal({botao: elemento, tipo: 'remover_produto'}),
        "save-btn": (elemento) => customModal({botao: elemento, tipo: 'salvar_cot', titulo: 'Salvar cotação', mensagem: 'Deseja realmente salvar esta cotação?'}),
        "formas-pagamento": (elemento) => mostrarCamposPagamento(),
        "button-up": (elemento) => scrollToSection(currentSection -1),
        "button-down": (elemento) => scrollToSection(currentSection +1)
    };

    //=====Itera sobre o mapeamento, adicionando o evento a cada classe=====//
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
    
    console.log(`DOM Content Loaded`);
});

let currentSection = 0;
const sections = document.querySelectorAll('.section');
const container = document.getElementById('container');

function scrollToSection(index) {
    if (index >= 0 && index < sections.length) {
        currentSection = index;
        const offset = index * -100; // Calcular o deslocamento em % negativo
        container.style.transform = `translateY(${offset}vh)`; // Mover o container para cima
    }
}

export function mostrarCamposPagamento() {
    const formaPagamento = document.querySelector('input[name="Forma_de_pagamento"]:checked').value;
    console.log(formaPagamento);

    let camposBoleto = document.querySelectorAll("#campos-boleto > *");
    camposBoleto.forEach(campo => campo.classList.add("hidden"));

    let camposDeposito = document.querySelectorAll("#campos-deposito > *");
    camposDeposito.forEach(campo => campo.classList.add("hidden"));

    if (formaPagamento === "Boleto") {

        camposBoleto.forEach(campo => campo.classList.remove("hidden"));
    } else if (formaPagamento === "Dep. em CC" || formaPagamento === "Dep. em CP") {
        
        camposDeposito.forEach(campo => campo.classList.remove("hidden"));
    }
}