// ====================================================================
// ⚠️ 1. CONFIGURAÇÃO DA API DO GOOGLE CALENDAR - SUBSTITUA OS VALORES! ⚠️
// ====================================================================

const API_KEY = 'AIzaSyCc77iWLeS0WFwiuyVR9AMidymfk4l9c9s'; 
const ANO_ATUAL = 2026;
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

// 💡 NOVO: MENSAGEM DE NOTIFICAÇÃO
// Se o valor for uma string vazia (''), o alerta não será exibido.
// Use esta variável para o texto do seu aviso.
const MENSAGEM_ALERTA = "";

// Mapeamento dos segmentos para os IDs do Calendário
const CALENDAR_IDS = {
    // Insira seus IDs REAIS aqui:
    'Infantil': 'SEU_ID_DO_CALENDARIO_EDUCACAO_INFANTIL@group.calendar.google.com',
    'Iniciais': 'SEU_ID_DO_CALENDARIO_FUNDAMENTAL_I@group.calendar.google.com',
    'Finais': 'SEU_ID_DO_CALENDARIO_FUNDAMENTAL_II@group.calendar.google.com',
    'Medio': 'c_c8e2a70aadd823b7d591eedc9dd34485fe457b67e29cd7556c025440e6051725@group.calendar.google.com',
};
// ====================================================================

let calendarioAtual = 'Infantil'; // Define o segmento inicial
let eventosDaApiCache = []; // NOVO: Variável global para armazenar os eventos brutos da API

// --- 2. FUNÇÕES DE CONTROLE DE ABAS ---

function setupTabs() {
    const botoes = document.querySelectorAll('.tab-button:not(#toggle-view-button):not(#info-button)');
    botoes.forEach(botao => {
        botao.addEventListener('click', function() {
            // Garante que a visualização de calendário é reativada ao trocar de segmento
            document.getElementById('calendarioAnual').classList.remove('hidden');
            document.getElementById('listaEventosContainer').classList.add('hidden');
            document.getElementById('toggle-view-button').textContent = 'Ver Lista de Eventos';

            // 1. Remove a classe 'active' de todos os botões de segmento
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            
            // 2. Adiciona a classe 'active' ao botão clicado
            this.classList.add('active');
            
            // 3. Define o novo calendário e busca os eventos
            calendarioAtual = this.getAttribute('data-segmento');
            
            const container = document.getElementById('calendarioAnual');
            container.innerHTML = `<p id="loading-message">Carregando calendário de ${this.textContent}...</p>`;

            buscarEventosDoGoogle();
        });
    });
}


// --- 3. FUNÇÕES DE INICIALIZAÇÃO DA API E BUSCA (COM TRATAMENTO DE ERROS) ---

function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
    }).then(function () {
        // Inicializa as abas
        setupTabs(); 
        // NOVO: Inicializa o botão de troca de visualização
        setupToggleView(); 
        // NOVO: Inicializa o botão de informações
        setupInfoButton();
        // 💡 NOVO: EXIBE A NOTIFICAÇÃO SE HOUVER MENSAGEM
        if (MENSAGEM_ALERTA) {
            const notifDiv = document.getElementById('notificacaoContainer');
            notifDiv.innerHTML = `<p>${MENSAGEM_ALERTA}</p>`;
            notifDiv.classList.remove('hidden');
        }
        // Carrega o primeiro calendário (Infantil)
        buscarEventosDoGoogle();
    }, function(error) {
        console.error('Erro ao inicializar o cliente da API:', error);
        document.getElementById('calendarioAnual').innerHTML = '<p class="erro-api">ERRO: Falha ao carregar a API do Google. Verifique sua API Key no script.js.</p>';
    });
}

function buscarEventosDoGoogle() {
    const idDoSegmento = CALENDAR_IDS[calendarioAtual];

    // Checagem de segurança para ID não configurado
    if (!idDoSegmento || idDoSegmento.includes('SEU_ID_DO_CALENDARIO')) {
         const container = document.getElementById('calendarioAnual');
         container.innerHTML = `<p class="erro-api">Erro: O ID do Calendário para o segmento "${calendarioAtual}" não foi configurado. Edite o script.js.</p>`;
         return;
    }

    const container = document.getElementById('calendarioAnual');
    // NOVO: Oculta a lista caso ela esteja visível antes de carregar
    document.getElementById('listaEventosContainer').classList.add('hidden');
    container.classList.remove('hidden'); // Garante que o calendário está visível
    container.innerHTML = '<p id="loading-message">Carregando eventos...</p>';

    const timeMin = new Date(ANO_ATUAL, 0, 1).toISOString(); 
    const timeMax = new Date(ANO_ATUAL, 11, 31).toISOString(); 

    gapi.client.calendar.events.list({
        'calendarId': idDoSegmento, 
        'timeMin': timeMin,
        'timeMax': timeMax,
        'showDeleted': false,
        'singleEvents': true,
        'orderBy': 'startTime'
    }).then(function(response) {
        // Sucesso na chamada
        const eventosDaApi = response.result.items;

        // 💡 NOVO: Lógica de Detecção de Novo Evento
        const botaoAtivo = document.querySelector(`.tab-button[data-segmento="${calendarioAtual}"]`);

        // 1. Verifica se existe pelo menos UM evento novo no segmento
        const possuiNovo = eventosDaApi.some(item => isNovoEvento(item));

    // 2. Aplica ou remove a classe CSS
        if (possuiNovo) {
            botaoAtivo.classList.add('has-new-events');
        } else {
        botaoAtivo.classList.remove('has-new-events');
    }
    // FIM DA LÓGICA DE DETECÇÃO DE NOVO EVENTO

        // NOVO: Salva os eventos brutos no cache para a visualização em lista
        eventosDaApiCache = eventosDaApi; 

        const eventosFormatados = formatarEventos(eventosDaApi);
        
        gerarCalendarioAnual(eventosFormatados);
    })
    .catch(function(error) {
        // Trata o erro de API e exibe uma mensagem útil
        console.error('Erro ao buscar eventos da API do Google:', error);
        
        let errorMessage = 'Falha crítica ao carregar eventos. Verifique o Console (F12) para detalhes.';
        
        if (error.result && error.result.error) {
             const apiError = error.result.error;
             
             if (apiError.code === 404) {
                 errorMessage = `Erro 404: Calendário não encontrado. O ID do calendário "${calendarioAtual}" pode estar incorreto.`;
             } else if (apiError.code === 403) {
                 errorMessage = `Erro 403: Acesso Proibido. O calendário "${calendarioAtual}" NÃO está configurado como PÚBLICO para leitura.`;
             } else {
                 errorMessage = `Erro de API (${apiError.code}): Verifique a Chave de API e as restrições de domínio.`;
             }
        }
        
        document.getElementById('calendarioAnual').innerHTML = `<p class="erro-api">${errorMessage}</p>`;
    });
}

// --- 4. FUNÇÕES DE PROCESSAMENTO E GERAÇÃO DO CALENDÁRIO GRID ---

function formatarEventos(eventosDaApi) {
    const eventos = {};
    eventosDaApi.forEach(item => {
        let data;
        let dataStr;
        
        // NOVO: Tratamento de fuso horário para eventos de Dia Inteiro
        if (item.start.date) {
            // Se for 'date' (dia inteiro), adiciona T12:00:00 para evitar o shift de fuso horário
            dataStr = `${item.start.date}T12:00:00`;
            data = new Date(dataStr);
        } else if (item.start.dateTime) {
            // Se for 'dateTime' (com hora), o fuso horário já está na string e funciona
            dataStr = item.start.dateTime;
            data = new Date(dataStr);
        } else {
             return; // Ignora eventos sem data
        }

        const mes = data.getMonth() + 1; 
        const dia = data.getDate();
        const chave = `${mes}-${dia}`;
        
        let nome = item.summary || 'Evento Sem Título';
        
        if (item.start.dateTime) {
            // Se for evento com hora, usamos a data original (item.start.dateTime)
            const horaData = new Date(item.start.dateTime); 
            const hora = horaData.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            nome = `[${hora}] ${nome}`;
        }
        
        if (eventos[chave]) {
            eventos[chave] += `, ${nome}`;
        } else {
            eventos[chave] = nome;
        }
    });
    return eventos;
}

function gerarCalendarioAnual(eventosImportantes) {
    const container = document.getElementById('calendarioAnual');
    container.innerHTML = ''; 
    
    const hasEvents = Object.keys(eventosImportantes).length > 0;
    
    // Mostra aviso se não houver eventos
    if (!hasEvents) {
        const botaoAtivo = document.querySelector(`.tab-button[data-segmento="${calendarioAtual}"]`);
        const nomeSegmento = botaoAtivo ? botaoAtivo.textContent : calendarioAtual;
        
        container.innerHTML = `<p class="aviso">O calendário de **${nomeSegmento}** não possui eventos configurados para ${ANO_ATUAL}.</p>`;
        return;
    }
    
    // ... (Código de geração do calendário Grid permanece inalterado) ...
    const nomesMeses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const nomesDiasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let mes = 0; mes < 12; mes++) {
        const mesDiv = document.createElement('div');
        mesDiv.className = 'mes';

        const tituloMes = document.createElement('h2');
        tituloMes.textContent = nomesMeses[mes] + ' ' + ANO_ATUAL;
        mesDiv.appendChild(tituloMes);

        const diasSemanaDiv = document.createElement('div');
        diasSemanaDiv.className = 'dias-semana';
        nomesDiasSemana.forEach(dia => {
            const span = document.createElement('span');
            span.textContent = dia;
            diasSemanaDiv.appendChild(span);
        });
        mesDiv.appendChild(diasSemanaDiv);

        const diasGridDiv = document.createElement('div');
        diasGridDiv.className = 'dias-grid';

        const primeiroDia = new Date(ANO_ATUAL, mes, 1);
        const diaDaSemana = primeiroDia.getDay();

        for (let i = 0; i < diaDaSemana; i++) {
            const vazio = document.createElement('span');
            vazio.className = 'dia vazio';
            diasGridDiv.appendChild(vazio);
        }

        const numDias = new Date(ANO_ATUAL, mes + 1, 0).getDate();

        for (let dia = 1; dia <= numDias; dia++) {
            const diaSpan = document.createElement('span');
            diaSpan.className = 'dia';
            diaSpan.textContent = dia;

            const chaveEvento = `${mes + 1}-${dia}`;
            
            if (eventosImportantes[chaveEvento]) {
                const nomeEvento = eventosImportantes[chaveEvento];
                
                diaSpan.classList.add('evento-dia');
                diaSpan.setAttribute('data-evento', nomeEvento); 
            }

            diasGridDiv.appendChild(diaSpan);
        }

        mesDiv.appendChild(diasGridDiv);
        container.appendChild(mesDiv);
    }
}


// ====================================================================
// NOVO: FUNÇÕES DE VISUALIZAÇÃO EM LISTA E NAVEGAÇÃO
// ====================================================================

/**
 * Alterna entre a visualização de Calendário (Grid) e a Lista Cronológica.
 */
function setupToggleView() {
    const toggleButton = document.getElementById('toggle-view-button');
    const calendarioGrid = document.getElementById('calendarioAnual');
    const listaContainer = document.getElementById('listaEventosContainer');

    toggleButton.addEventListener('click', function() {
        // Se a lista estiver escondida (estamos vendo o calendário)
        if (listaContainer.classList.contains('hidden')) {
            // Esconde o Calendário (Grid)
            calendarioGrid.classList.add('hidden');
            // Mostra a Lista
            listaContainer.classList.remove('hidden');
            
            toggleButton.textContent = 'Ver Calendário';
            
            // Gera a lista usando o cache de eventos
            gerarListaEventos(eventosDaApiCache); 
        } else {
            // Voltamos para o Calendário (Grid)
            listaContainer.classList.add('hidden');
            calendarioGrid.classList.remove('hidden');
            
            toggleButton.textContent = 'Ver Lista de Eventos';
        }
    });
}

/**
 * Converte a lista de eventos da API (cache) em HTML para visualização cronológica.
 * @param {Array} eventosDaApi - Lista de eventos RAW armazenada no cache.
 */
function gerarListaEventos(eventosDaApi) {
    const listaContainer = document.getElementById('listaEventosContainer');
    
    // Filtra eventos válidos e garante que a data seja ajustada antes da ordenação
    const eventosValidos = eventosDaApi
        .filter(item => item.start && (item.start.date || item.start.dateTime))
        .map(item => {
            let data;
            
            if (item.start.date) {
                // Se for 'date' (dia inteiro), aplica o ajuste do T12:00:00
                data = new Date(`${item.start.date}T12:00:00`);
            } else {
                // Se for 'dateTime' (com hora), usa a data original
                data = new Date(item.start.dateTime);
            }
            
            return {
                data,
                summary: item.summary,
                isTimed: !!item.start.dateTime, // Se tem 'dateTime', é um evento com horário
            };
        });

    if (!eventosValidos || eventosValidos.length === 0) {
        listaContainer.innerHTML = '<h2>Lista de Eventos</h2><p class="aviso">Nenhum evento encontrado para este segmento em 2026.</p>';
        return;
    }

    let html = '<h2>Lista de Eventos em Ordem Cronológica</h2><ul class="eventos-lista">';

    eventosValidos.forEach(item => {
        // Agora, 'item.data' é o objeto Date já ajustado (ou correto)
        const dataFormatada = item.data.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        let nomeEvento = item.summary || 'Evento Sem Título';
        
        if (item.isTimed) {
            const hora = item.data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            nomeEvento = `[${hora}] ${nomeEvento}`;
        }

        html += `
            <li class="evento-item">
                <span class="data-evento">${dataFormatada}</span>
                <span class="nome-evento">${nomeEvento}</span>
            </li>
        `;
    });

    html += '</ul>';
    listaContainer.innerHTML = html;
}

/**
 * Adiciona o listener para o botão de informações externas.
 */
function setupInfoButton() {
    const infoButton = document.getElementById('info-button');
    // ** MANTENHA O NOME DO ARQUIVO SE ELE ESTIVER NA MESMA PASTA **
    const urlDaPagina = 'https://eddiejs.github.io/informacoesImpotantes-cursos-escola/index.html'; 

    infoButton.addEventListener('click', function() {
        // Abre a nova página em uma nova aba
        window.open(urlDaPagina, '_blank');
    });
}


// --- 6. INICIALIZAÇÃO ---

function handleClientLoad() {
    gapi.load('client', initClient);
}

document.addEventListener('DOMContentLoaded', function() {
    window.handleClientLoad = handleClientLoad;
    
    if (typeof gapi !== 'undefined') {
        gapi.load('client', initClient);
    }
});

/**
 * Verifica se um evento é considerado "novo" com base na data de criação/atualização.
 * @param {object} item - Objeto de evento da API do Google Calendar.
 * @returns {boolean} - Retorna true se for novo.
 */
function isNovoEvento(item) {
    // Define o limite de tempo: 14 dias atrás
    const limiteNovo = new Date();
    limiteNovo.setDate(limiteNovo.getDate() - 7); 

    // Usa o campo updated (mais confiável para mudança) ou created
    const dataReferencia = new Date(item.updated || item.created);

    // Retorna TRUE se a data de referência for MAIOR que o nosso limite (ou seja, mais recente)
    return dataReferencia > limiteNovo;
}
