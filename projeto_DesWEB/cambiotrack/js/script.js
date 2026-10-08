'use strict';
const API_URL = 'https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL';

class OperacaoCambio {
  #status; 

  static SPREAD = 0.02; 
  static #proximoId = 1; 

  /**
   * @param {string} origem  
   * @param {string} destino 
   * @param {number} montante 
   * @param {number} cotacao  
   * @param {number} valorBRL 
   */
  constructor(origem, destino, montante, cotacao, valorBRL) {
    this.id = OperacaoCambio.#proximoId++;
    this.origem = origem;
    this.destino = destino;
    this.montante = montante;
    this.cotacao = cotacao;
    this.valorBRL = valorBRL;
    this.data = new Date();
    this.#status = 'Ativa';
  }
  get status() {
    return this.#status;
  }

  /**
   * Cancela a ordem.
   * @returns {boolean} 
   */
  cancelar() {
    if (this.#status === 'Cancelada') return false;
    this.#status = 'Cancelada';
    return true;
  }

  /**
   
   * @returns {number} 
   */
  converter() {
    return this.montante * this.cotacao * (1 - OperacaoCambio.SPREAD);
  }

  /**
   * Método utilitário estático: formata valor conforme a moeda.
   * @param {number} valor
   * @param {string} moeda
   * @returns {string}
   */
  static formatar(valor, moeda) {
    if (moeda === 'BTC') return `₿ ${valor.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}`;
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: moeda });
  }
}

/**
 * Gerencia a coleção de transações (Gerenciador).
 */
class CarteiraFinanceira {
  #transacoes = []; // coleção privada

  /** Retorna uma cópia da lista (protege o campo privado). */
  get transacoes() {
    return [...this.#transacoes];
  }

  /**
   * Adiciona uma operação à carteira.
   * @param {OperacaoCambio} operacao
   */
  adicionar(operacao) {
    this.#transacoes.unshift(operacao);
  }

  /**
   * Cancela uma operação pelo id.
   * @param {number} id
   * @returns {boolean}
   */
  cancelar(id) {
    const op = this.#transacoes.find((t) => t.id === id);
    return op ? op.cancelar() : false;
  }

  /**
   * Remove definitivamente uma operação pelo id.
   * @param {number} id
   */
  remover(id) {
    this.#transacoes = this.#transacoes.filter((t) => t.id !== id);
  }

  /** Total movimentado (em BRL), ignorando ordens canceladas. */
  totalMovimentado() {
    return this.#transacoes
      .filter((t) => t.status === 'Ativa')
      .reduce((soma, t) => soma + t.valorBRL, 0);
  }

  /** Conta ordens por status. */
  contar(status) {
    return this.#transacoes.filter((t) => t.status === status).length;
  }
}
const carteira = new CarteiraFinanceira();
let taxasBRL = { BRL: 1 }; 

const $ = (id) => document.getElementById(id);
const elCotacoes = $('cotacoes');
const elStatusApi = $('status-api');
const elForm = $('form-conversao');
const elMsg = $('msg-form');
const elLista = $('lista');
const mostrarAviso = (el, texto, tipo = '') => {
  el.textContent = texto;
  el.className = `aviso ${tipo}`;
};
async function carregarCotacoes() {
  const botao = $('btn-atualizar');
  botao.disabled = true;
  mostrarAviso(elStatusApi, 'Carregando cotações...', 'carregando');
  try {
    const resposta = await fetch(API_URL);
    if (!resposta.ok) throw new Error(`Erro HTTP ${resposta.status}`);
    const dados = await resposta.json();

    taxasBRL = {
      BRL: 1,
      USD: parseFloat(dados.USDBRL.bid),
      EUR: parseFloat(dados.EURBRL.bid),
      BTC: parseFloat(dados.BTCBRL.bid),
    };
    renderizarCotacoes(dados);
    mostrarAviso(elStatusApi, `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`, 'ok');
  } catch (erro) {
    mostrarAviso(elStatusApi, `Falha ao buscar cotações: ${erro.message}. Tente novamente.`, 'erro');
  } finally {
    botao.disabled = false; // sempre reabilita o botão
  }
}
function renderizarCotacoes(dados) {
  elCotacoes.replaceChildren();
  ['USDBRL', 'EURBRL', 'BTCBRL'].forEach((chave) => {
    const item = dados[chave];
    const card = document.createElement('article');
    card.className = 'cotacao';

    const nome = document.createElement('small');
    nome.textContent = item.name;
    const valor = document.createElement('strong');
    valor.textContent = OperacaoCambio.formatar(parseFloat(item.bid), 'BRL');
    const variacao = document.createElement('small');
    const pct = parseFloat(item.pctChange);
    variacao.textContent = `Variação: ${pct > 0 ? '+' : ''}${pct}%`;
    variacao.className = pct >= 0 ? 'sobe' : 'desce';

    card.append(nome, valor, variacao);
    elCotacoes.append(card);
  });
}
function renderizarTudo() {
  elLista.replaceChildren();
  const lista = carteira.transacoes;
  $('vazio').hidden = lista.length > 0;

  lista.forEach((op) => {
    const card = document.createElement('article');
    card.className = `transacao ${op.status === 'Cancelada' ? 'cancelada' : ''}`;

    const selo = document.createElement('span');
    selo.className = 'selo';
    selo.textContent = op.status;

    const titulo = document.createElement('strong');
    titulo.textContent = `${op.origem} ➔ ${op.destino}`;

    const detalhe = document.createElement('p');
    detalhe.textContent = `${OperacaoCambio.formatar(op.montante, op.origem)} = ${OperacaoCambio.formatar(op.converter(), op.destino)}`;

    const info = document.createElement('small');
    info.textContent = `Cotação: ${op.cotacao.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} | Spread: ${OperacaoCambio.SPREAD * 100}% | ${op.data.toLocaleString('pt-BR')}`;

    const acoes = document.createElement('div');
    acoes.className = 'acoes';

    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'neutro';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.disabled = op.status === 'Cancelada';
    btnCancelar.addEventListener('click', () => {
      carteira.cancelar(op.id);
      renderizarTudo();
    });

    const btnRemover = document.createElement('button');
    btnRemover.type = 'button';
    btnRemover.className = 'perigo';
    btnRemover.textContent = 'Excluir';
    btnRemover.addEventListener('click', () => {
      card.remove(); // remove o nó do DOM
      carteira.remover(op.id);
      renderizarTudo();
    });

    acoes.append(btnCancelar, btnRemover);
    card.append(selo, titulo, detalhe, info, acoes);
    elLista.append(card);
  });

  $('ind-total').textContent = OperacaoCambio.formatar(carteira.totalMovimentado(), 'BRL');
  $('ind-ativas').textContent = carteira.contar('Ativa');
  $('ind-canceladas').textContent = carteira.contar('Cancelada');
}

/**
 * Trata o envio do formulário: valida, calcula a cotação cruzada,
 * cria a OperacaoCambio e atualiza a tela (sem recarregar a página).
 * @param {SubmitEvent} evento
 */
function aoEnviarFormulario(evento) {
  evento.preventDefault();

  if (!taxasBRL.USD) {
    mostrarAviso(elMsg, 'Aguarde as cotações carregarem (ou clique em Atualizar).', 'erro');
    return;
  }
  const montante = parseFloat($('montante').value);
  const origem = $('origem').value;
  const destino = $('destino').value;

  if (origem === destino) {
    mostrarAviso(elMsg, 'Escolha moedas diferentes.', 'erro');
    return;
  }
  const cotacao = taxasBRL[origem] / taxasBRL[destino];
  const valorBRL = montante * taxasBRL[origem];
  carteira.adicionar(new OperacaoCambio(origem, destino, montante, cotacao, valorBRL));
  renderizarTudo();
  elForm.reset();
  mostrarAviso(elMsg, 'Ordem simulada com sucesso!', 'ok');
}
elForm.addEventListener('submit', aoEnviarFormulario);
$('btn-atualizar').addEventListener('click', carregarCotacoes);
renderizarTudo();
carregarCotacoes();
