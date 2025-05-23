/**
 * @fileoverview Controlador principal para importação e processamento de arquivos SPED
 * Coordena todo o fluxo de importação, processamento e integração com o simulador
 * 
 * @module importacao-controller
 * @author Expertzy Inteligência Tributária
 * @version 1.0.0
 */

window.ImportacaoController = (function() {
    
    // Estado do controlador
    let estadoImportacao = {
        arquivosCarregados: {},
        dadosProcessados: {},
        errosProcessamento: [],
        statusAtual: 'aguardando',
        progressoTotal: 0
    };

    // Configurações do controlador
    const CONFIG = {
        tamanhoMaximoArquivo: 50 * 1024 * 1024, // 50MB
        tiposArquivoAceitos: ['.txt'],
        timeoutProcessamento: 120000, // 2 minutos
        logDetalhado: true
    };

    /**
     * Inicializa o controlador de importação
     */
    function inicializar() {
        console.log('Inicializando Controlador de Importação SPED...');
        
        // Verificar dependências
        if (!window.SpedParser) {
            console.error('SpedParser não encontrado. Carregue sped-parser.js primeiro.');
            return false;
        }
        
        if (!window.SpedExtractor) {
            console.error('SpedExtractor não encontrado. Carregue sped-extractor.js primeiro.');
            return false;
        }

        if (!window.DataManager) {
            console.error('DataManager não encontrado. Sistema de importação requer DataManager.');
            return false;
        }

        // Configurar event listeners
        configurarEventListeners();

        // Limpar estado inicial
        limparEstadoImportacao();

        adicionarLogImportacao('✓ Controlador de Importação SPED inicializado com sucesso', 'info');
        return true;
    }

    /**
     * Configura os event listeners para a interface de importação
     */
    function configurarEventListeners() {
        // Botão de importação principal
        const btnImportar = document.getElementById('btn-importar-sped');
        if (btnImportar) {
            btnImportar.addEventListener('click', iniciarProcessoImportacao);
        }

        // Botão de cancelamento
        const btnCancelar = document.getElementById('btn-cancelar-importacao');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', cancelarImportacao);
        }

        // Inputs de arquivo
        const inputsArquivo = [
            'sped-fiscal',
            'sped-contribuicoes', 
            'sped-ecf',
            'sped-ecd'
        ];

        inputsArquivo.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', function(event) {
                    validarArquivoSelecionado(event.target, id);
                });
            }
        });

        console.log('Event listeners configurados para importação SPED');
    }

    /**
     * Valida arquivo selecionado pelo usuário
     * @param {HTMLInputElement} input - Input de arquivo
     * @param {string} tipoSped - Tipo de SPED (fiscal, contribuicoes, etc.)
     */
    function validarArquivoSelecionado(input, tipoSped) {
        if (!input.files || input.files.length === 0) {
            return;
        }

        const arquivo = input.files[0];
        const validacao = {
            valido: true,
            erros: [],
            avisos: []
        };

        // Validar tamanho
        if (arquivo.size > CONFIG.tamanhoMaximoArquivo) {
            validacao.valido = false;
            validacao.erros.push(`Arquivo muito grande: ${formatarTamanhoArquivo(arquivo.size)}. Máximo: ${formatarTamanhoArquivo(CONFIG.tamanhoMaximoArquivo)}`);
        }

        // Validar extensão
        const extensao = arquivo.name.toLowerCase().split('.').pop();
        if (!CONFIG.tiposArquivoAceitos.includes('.' + extensao)) {
            validacao.erros.push(`Tipo de arquivo não suportado: .${extensao}. Tipos aceitos: ${CONFIG.tiposArquivoAceitos.join(', ')}`);
        }

        // Validar nome do arquivo (heurística simples)
        const nomeArquivo = arquivo.name.toLowerCase();
        if (!nomeArquivo.includes('sped') && !nomeArquivo.includes('efd') && !nomeArquivo.includes('ecf') && !nomeArquivo.includes('ecd')) {
            validacao.avisos.push('Nome do arquivo não parece ser de um SPED. Verifique se o arquivo está correto.');
        }

        // Atualizar interface com resultado da validação
        atualizarStatusValidacao(tipoSped, validacao);

        // Armazenar arquivo se válido
        if (validacao.valido) {
            estadoImportacao.arquivosCarregados[tipoSped] = {
                arquivo: arquivo,
                validacao: validacao,
                timestampCarregamento: new Date().toISOString()
            };
            
            adicionarLogImportacao(`📁 Arquivo ${arquivo.name} carregado para ${tipoSped.toUpperCase()}`, 'info');
        } else {
            // Limpar arquivo inválido
            input.value = '';
            delete estadoImportacao.arquivosCarregados[tipoSped];
            
            adicionarLogImportacao(`❌ Arquivo ${arquivo.name} rejeitado: ${validacao.erros.join(', ')}`, 'error');
        }
    }

    /**
     * Atualiza status de validação na interface
     * @param {string} tipoSped - Tipo de SPED
     * @param {Object} validacao - Resultado da validação
     */
    function atualizarStatusValidacao(tipoSped, validacao) {
        const containerStatus = document.querySelector(`#${tipoSped}-status`) || 
                               document.querySelector(`.validation-status[data-sped="${tipoSped}"]`);
        
        if (containerStatus) {
            containerStatus.innerHTML = '';
            
            if (validacao.valido) {
                containerStatus.innerHTML = '<span class="status-success">✓ Arquivo válido</span>';
            } else {
                const errosHtml = validacao.erros.map(erro => `<div class="status-error">❌ ${erro}</div>`).join('');
                containerStatus.innerHTML = errosHtml;
            }
            
            if (validacao.avisos.length > 0) {
                const avisosHtml = validacao.avisos.map(aviso => `<div class="status-warning">⚠️ ${aviso}</div>`).join('');
                containerStatus.innerHTML += avisosHtml;
            }
        }
    }

    /**
     * Inicia o processo completo de importação
     */
    async function iniciarProcessoImportacao() {
        console.log('Iniciando processo de importação SPED...');
        
        try {
            // Verificar se há arquivos carregados
            const arquivosDisponiveis = Object.keys(estadoImportacao.arquivosCarregados);
            if (arquivosDisponiveis.length === 0) {
                throw new Error('Nenhum arquivo SPED foi selecionado para importação');
            }

            // Atualizar estado
            estadoImportacao.statusAtual = 'processando';
            estadoImportacao.progressoTotal = 0;
            estadoImportacao.errosProcessamento = [];

            // Atualizar interface
            atualizarInterfaceProgresso('Iniciando processamento...', 0);
            desabilitarControlesImportacao(true);

            adicionarLogImportacao(`🚀 Iniciando importação de ${arquivosDisponiveis.length} arquivo(s) SPED`, 'info');

            // Processar cada arquivo
            const totalArquivos = arquivosDisponiveis.length;
            let arquivosProcessados = 0;

            for (const tipoSped of arquivosDisponiveis) {
                try {
                    adicionarLogImportacao(`📊 Processando ${tipoSped.toUpperCase()}...`, 'info');
                    
                    const dadosProcessados = await processarArquivoSped(tipoSped);
                    estadoImportacao.dadosProcessados[tipoSped] = dadosProcessados;
                    
                    arquivosProcessados++;
                    const progresso = (arquivosProcessados / totalArquivos) * 50; // 50% para processamento
                    atualizarInterfaceProgresso(`${tipoSped.toUpperCase()} processado`, progresso);
                    
                    adicionarLogImportacao(`✅ ${tipoSped.toUpperCase()} processado com sucesso`, 'success');
                    
                } catch (erro) {
                    console.error(`Erro ao processar ${tipoSped}:`, erro);
                    estadoImportacao.errosProcessamento.push({
                        tipo: tipoSped,
                        erro: erro.message,
                        timestamp: new Date().toISOString()
                    });
                    
                    adicionarLogImportacao(`❌ Erro ao processar ${tipoSped.toUpperCase()}: ${erro.message}`, 'error');
                }
            }

            // Consolidar dados extraídos
            atualizarInterfaceProgresso('Consolidando dados extraídos...', 60);
            adicionarLogImportacao('🔄 Consolidando dados extraídos de todos os SPEDs...', 'info');
            
            const dadosConsolidados = await consolidarDadosImportados();
            
            // Integrar com o simulador
            atualizarInterfaceProgresso('Integrando com o simulador...', 80);
            adicionarLogImportacao('🔗 Integrando dados com o simulador...', 'info');
            
            await integrarComSimulador(dadosConsolidados);

            // Finalizar processo
            estadoImportacao.statusAtual = 'concluido';
            atualizarInterfaceProgresso('Importação concluída com sucesso!', 100);
            
            const resumo = gerarResumoImportacao();
            adicionarLogImportacao(`🎉 Importação concluída! ${resumo}`, 'success');
            
            // Notificar outros componentes
            notificarImportacaoConcluida(dadosConsolidados);

        } catch (erro) {
            console.error('Erro no processo de importação:', erro);
            estadoImportacao.statusAtual = 'erro';
            
            atualizarInterfaceProgresso(`Erro: ${erro.message}`, 0);
            adicionarLogImportacao(`💥 Falha na importação: ${erro.message}`, 'error');
            
        } finally {
            desabilitarControlesImportacao(false);
        }
    }

    /**
     * Processa um arquivo SPED específico
     * @param {string} tipoSped - Tipo do SPED a processar
     * @returns {Promise<Object>} Dados processados do SPED
     */
    async function processarArquivoSped(tipoSped) {
        const infoArquivo = estadoImportacao.arquivosCarregados[tipoSped];
        if (!infoArquivo) {
            throw new Error(`Arquivo ${tipoSped} não encontrado`);
        }

        const arquivo = infoArquivo.arquivo;
        adicionarLogImportacao(`📖 Lendo arquivo ${arquivo.name} (${formatarTamanhoArquivo(arquivo.size)})...`, 'info');

        // Parsing inicial do arquivo
        const opcoesParsing = {
            validarIntegridade: true,
            incluirEstatisticas: true,
            extrairTodos: false
        };

        const resultadoParsing = await window.SpedParser.parsearArquivoSped(arquivo, opcoesParsing);
        
        if (!resultadoParsing.sucesso) {
            throw new Error(`Falha no parsing: ${resultadoParsing.erro}`);
        }

        adicionarLogImportacao(`📋 Tipo identificado: ${resultadoParsing.tipoSped.detalhes.descricao}`, 'info');
        adicionarLogImportacao(`🏢 Empresa: ${resultadoParsing.dadosEmpresa.razaoSocial}`, 'info');
        adicionarLogImportacao(`📅 Período: ${resultadoParsing.dadosEmpresa.dataInicialPeriodo} a ${resultadoParsing.dadosEmpresa.dataFinalPeriodo}`, 'info');

        // Log de estatísticas detalhadas
        if (resultadoParsing.estatisticas) {
            const stats = resultadoParsing.estatisticas;
            adicionarLogImportacao(`📊 Estatísticas: ${stats.linhasProcessadas} linhas processadas, ${stats.registrosEncontrados} registros extraídos`, 'info');
            
            if (stats.erros && stats.erros.length > 0) {
                adicionarLogImportacao(`⚠️ ${stats.erros.length} erro(s) encontrado(s) durante o parsing`, 'warning');
                stats.erros.slice(0, 3).forEach(erro => {
                    adicionarLogImportacao(`   Linha ${erro.linha}: ${erro.erro}`, 'warning');
                });
            }
        }

        // Extração de dados específicos
        adicionarLogImportacao(`🔍 Extraindo dados específicos para simulação...`, 'info');
        
        const opcoesExtracao = {
            incluirComposicaoTributaria: true,
            incluirCreditosTributarios: true,
            incluirDadosFinanceiros: true,
            incluirCicloFinanceiro: true,
            calcularTransicao: false // Será feito na consolidação
        };

        const spedData = {};
        spedData[tipoSped] = resultadoParsing;

        const dadosExtraidos = window.SpedExtractor.processarDadosConsolidados(spedData, opcoesExtracao);
        
        // Log detalhado dos dados extraídos
        logDadosExtraidos(tipoSped, dadosExtraidos);

        return {
            parsing: resultadoParsing,
            extracao: dadosExtraidos,
            metadados: {
                tipoSped: tipoSped,
                nomeArquivo: arquivo.name,
                tamanhoArquivo: arquivo.size,
                timestampProcessamento: new Date().toISOString()
            }
        };
    }

    /**
     * Consolidar dados importados de todos os SPEDs
     * @returns {Promise<Object>} Dados consolidados
     */
    async function consolidarDadosImportados() {
        adicionarLogImportacao('🔄 Iniciando consolidação de dados...', 'info');

        const speds = {};
        
        // Organizar dados para consolidação
        Object.keys(estadoImportacao.dadosProcessados).forEach(tipoSped => {
            const dados = estadoImportacao.dadosProcessados[tipoSped];
            speds[tipoSped] = dados.parsing;
        });

        // Configurar opções de consolidação
        const opcoesConsolidacao = {
            incluirComposicaoTributaria: true,
            incluirCreditosTributarios: true, 
            incluirDadosFinanceiros: true,
            incluirCicloFinanceiro: true,
            calcularTransicao: true,
            parametrosIVA: {
                aliquotaCBS: 8.8,
                aliquotaIBS: 17.7,
                aliquotaTotal: 26.5
            }
        };

        const dadosConsolidados = window.SpedExtractor.processarDadosConsolidados(speds, opcoesConsolidacao);
        
        // Log detalhado da consolidação
        logConsolidacao(dadosConsolidados);

        return dadosConsolidados;
    }

    /**
     * Integra dados consolidados com o simulador
     * @param {Object} dadosConsolidados - Dados consolidados dos SPEDs
     */
    async function integrarComSimulador(dadosConsolidados) {
        if (!window.DataManager) {
            throw new Error('DataManager não disponível para integração');
        }

        adicionarLogImportacao('🔗 Convertendo dados para estrutura do simulador...', 'info');

        // Criar estrutura canônica do DataManager
        const dadosEstruturados = window.DataManager.obterEstruturaAninhadaPadrao();

        // Mapear dados da empresa
        if (dadosConsolidados.empresaInfo) {
            const empresa = dadosConsolidados.empresaInfo;
            dadosEstruturados.empresa.nome = empresa.razaoSocial || '';
            dadosEstruturados.empresa.cnpj = empresa.cnpj || '';
            dadosEstruturados.empresa.inscricaoEstadual = empresa.inscricaoEstadual || '';
            dadosEstruturados.empresa.uf = empresa.uf || '';
            
            adicionarLogImportacao(`✓ Dados da empresa mapeados: ${empresa.razaoSocial}`, 'info');
        }

        // Mapear composição tributária
        if (dadosConsolidados.composicaoTributaria) {
            const composicao = dadosConsolidados.composicaoTributaria;
            
            // Definir faturamento baseado nos dados reais
            dadosEstruturados.empresa.faturamento = composicao.faturamentoTotal || 0;
            
            // Mapear créditos tributários
            dadosEstruturados.parametrosFiscais.creditos = {
                pis: composicao.creditos.pis || 0,
                cofins: composicao.creditos.cofins || 0,
                icms: composicao.creditos.icms || 0,
                ipi: composicao.creditos.ipi || 0,
                cbs: 0,
                ibs: 0
            };

            // Calcular alíquota efetiva total
            dadosEstruturados.parametrosFiscais.aliquota = (composicao.aliquotasEfetivas.total || 0) / 100;
            
            adicionarLogImportacao(`✓ Composição tributária mapeada - Alíquota efetiva: ${composicao.aliquotasEfetivas.total.toFixed(2)}%`, 'info');
        }

        // Mapear dados financeiros
        if (dadosConsolidados.dadosFinanceiros) {
            const financeiro = dadosConsolidados.dadosFinanceiros;
            
            // Calcular margem operacional real
            if (financeiro.resultado.margemOperacional > 0) {
                dadosEstruturados.empresa.margem = financeiro.resultado.margemOperacional / 100;
                adicionarLogImportacao(`✓ Margem operacional real: ${financeiro.resultado.margemOperacional.toFixed(2)}%`, 'info');
            }
            
            // Adicionar dados de custos e receitas
            dadosEstruturados.empresa.receitas = {
                receitaBruta: financeiro.receitas.receitaBruta || 0,
                receitaLiquida: financeiro.receitas.receitaLiquida || 0
            };
            
            dadosEstruturados.empresa.custos = {
                custoTotal: financeiro.custos.custoTotal || 0,
                despesasOperacionais: financeiro.despesas.despesasOperacionais || 0
            };
            
            dadosEstruturados.empresa.resultado = {
                lucroOperacional: financeiro.resultado.lucroOperacional || 0,
                lucroLiquido: financeiro.resultado.lucroLiquido || 0
            };
        }

        // Mapear ciclo financeiro
        if (dadosConsolidados.cicloFinanceiro) {
            const ciclo = dadosConsolidados.cicloFinanceiro;
            
            dadosEstruturados.cicloFinanceiro.pmr = ciclo.pmr || 30;
            dadosEstruturados.cicloFinanceiro.pme = ciclo.pme || 30;
            dadosEstruturados.cicloFinanceiro.pmp = ciclo.pmp || 30;
            
            adicionarLogImportacao(`✓ Ciclo financeiro mapeado - PMR: ${ciclo.pmr}, PME: ${ciclo.pme}, PMP: ${ciclo.pmp}`, 'info');
        }

        // Adicionar metadados de importação
        dadosEstruturados.metadados = {
            fonteDados: 'sped',
            timestampImportacao: new Date().toISOString(),
            arquivosImportados: Object.keys(estadoImportacao.arquivosCarregados),
            precisaoCalculos: 'alta'
        };

        // Validar e normalizar dados
        const dadosValidados = window.DataManager.validarENormalizar(dadosEstruturados);
        
        // Armazenar dados validados globalmente
        window.dadosImportadosSped = dadosValidados;
        
        // Preencher formulário do simulador
        window.DataManager.preencherFormulario(dadosValidados);
        
        adicionarLogImportacao('✅ Dados integrados com sucesso ao simulador!', 'success');
        adicionarLogImportacao('🎯 Formulário do simulador preenchido automaticamente', 'success');

        // Adicionar indicador visual no simulador
        adicionarIndicadorDadosSped();
    }

    /**
     * Adiciona indicador visual no simulador sobre dados SPED
     */
    function adicionarIndicadorDadosSped() {
        // Remover indicador existente
        const indicadorExistente = document.querySelector('.sped-data-indicator');
        if (indicadorExistente) {
            indicadorExistente.remove();
        }

        // Criar novo indicador
        const indicador = document.createElement('div');
        indicador.className = 'alert alert-info sped-data-indicator';
        indicador.innerHTML = `
            <strong><i class="fas fa-database"></i> Dados SPED Integrados:</strong> 
            O simulador está utilizando dados tributários reais extraídos dos arquivos SPED importados.
            <button type="button" class="btn btn-sm btn-outline-primary ml-2" onclick="exibirDetalhesImportacao()">
                Ver Detalhes
            </button>
        `;

        // Inserir no formulário principal
        const formPrincipal = document.querySelector('.simulation-inputs .panel');
        if (formPrincipal) {
            formPrincipal.insertBefore(indicador, formPrincipal.firstChild);
        }

        // Marcar campos como dados SPED
        marcarCamposComDadosSped();
    }

    /**
     * Marca campos que foram preenchidos com dados SPED
     */
    function marcarCamposComDadosSped() {
        const camposSped = [
            'faturamento',
            'margem', 
            'pmr',
            'pmp',
            'pme',
            'debito-pis',
            'debito-cofins',
            'debito-icms',
            'debito-ipi',
            'credito-pis',
            'credito-cofins',
            'credito-icms',
            'credito-ipi',
            'aliquota-efetiva-total'
        ];

        camposSped.forEach(id => {
            const campo = document.getElementById(id);
            if (campo) {
                campo.classList.add('sped-data');
                campo.title = 'Valor extraído dos arquivos SPED importados';
                
                // Adicionar ícone indicativo
                if (!campo.parentElement.querySelector('.sped-icon')) {
                    const icon = document.createElement('span');
                    icon.className = 'sped-icon';
                    icon.innerHTML = '<i class="fas fa-database text-info"></i>';
                    icon.title = 'Dados extraídos do SPED';
                    campo.parentElement.appendChild(icon);
                }
            }
        });
    }

    /**
     * Cancela o processo de importação
     */
    function cancelarImportacao() {
        if (estadoImportacao.statusAtual === 'processando') {
            estadoImportacao.statusAtual = 'cancelado';
            adicionarLogImportacao('🛑 Importação cancelada pelo usuário', 'warning');
        }
        
        limparEstadoImportacao();
        atualizarInterfaceProgresso('Importação cancelada', 0);
        desabilitarControlesImportacao(false);
    }

    /**
     * Limpa o estado da importação
     */
    function limparEstadoImportacao() {
        estadoImportacao = {
            arquivosCarregados: {},
            dadosProcessados: {},
            errosProcessamento: [],
            statusAtual: 'aguardando',
            progressoTotal: 0
        };

        // Limpar interface
        const logArea = document.getElementById('import-log');
        if (logArea) {
            logArea.innerHTML = '<p class="text-muted">Selecione os arquivos SPED e clique em "Importar Dados" para iniciar o processo.</p>';
        }

        // Limpar validações
        document.querySelectorAll('.validation-status').forEach(element => {
            element.innerHTML = '';
        });
    }

    /**
     * Atualiza interface de progresso
     * @param {string} mensagem - Mensagem de status
     * @param {number} progresso - Progresso em percentual (0-100)
     */
    function atualizarInterfaceProgresso(mensagem, progresso) {
        // Atualizar barra de progresso se existir
        const barraProgresso = document.querySelector('.progress-bar');
        if (barraProgresso) {
            barraProgresso.style.width = `${progresso}%`;
            barraProgresso.setAttribute('aria-valuenow', progresso);
        }

        // Atualizar mensagem de status
        const statusMensagem = document.querySelector('.status-message');
        if (statusMensagem) {
            statusMensagem.textContent = mensagem;
        }

        estadoImportacao.progressoTotal = progresso;
    }

    /**
     * Habilita/desabilita controles de importação
     * @param {boolean} desabilitar - Se deve desabilitar os controles
     */
    function desabilitarControlesImportacao(desabilitar) {
        const controles = [
            'btn-importar-sped',
            'sped-fiscal',
            'sped-contribuicoes',
            'sped-ecf', 
            'sped-ecd'
        ];

        controles.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.disabled = desabilitar;
            }
        });

        // Mostrar/ocultar botão de cancelar
        const btnCancelar = document.getElementById('btn-cancelar-importacao');
        if (btnCancelar) {
            btnCancelar.style.display = desabilitar ? 'inline-block' : 'none';
        }
    }

    /**
     * Adiciona entrada no log de importação
     * @param {string} mensagem - Mensagem do log
     * @param {string} tipo - Tipo do log (info, success, warning, error)
     */
    function adicionarLogImportacao(mensagem, tipo = 'info') {
        const logArea = document.getElementById('import-log');
        if (!logArea) return;

        const timestamp = new Date().toLocaleTimeString();
        const classesTipo = {
            'info': 'text-info',
            'success': 'text-success', 
            'warning': 'text-warning',
            'error': 'text-danger'
        };

        const entrada = document.createElement('div');
        entrada.className = `log-entry ${classesTipo[tipo] || 'text-info'}`;
        entrada.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${mensagem}`;

        logArea.appendChild(entrada);
        logArea.scrollTop = logArea.scrollHeight;

        // Log no console também se configurado
        if (CONFIG.logDetalhado) {
            console.log(`[IMPORTACAO] ${timestamp}: ${mensagem}`);
        }
    }

    /**
     * Gera resumo da importação
     * @returns {string} Resumo textual
     */
    function gerarResumoImportacao() {
        const totalArquivos = Object.keys(estadoImportacao.arquivosCarregados).length;
        const arquivosProcessados = Object.keys(estadoImportacao.dadosProcessados).length;
        const erros = estadoImportacao.errosProcessamento.length;

        return `${arquivosProcessados}/${totalArquivos} arquivo(s) processado(s) ${erros > 0 ? `com ${erros} erro(s)` : 'com sucesso'}`;
    }

    /**
     * Log detalhado dos dados extraídos
     * @param {string} tipoSped - Tipo do SPED
     * @param {Object} dadosExtraidos - Dados extraídos
     */
    function logDadosExtraidos(tipoSped, dadosExtraidos) {
        if (!CONFIG.logDetalhado) return;

        const upper = tipoSped.toUpperCase();
        
        if (dadosExtraidos.composicaoTributaria) {
            const comp = dadosExtraidos.composicaoTributaria;
            adicionarLogImportacao(`   📊 ${upper}: Faturamento R$ ${comp.faturamentoTotal.toFixed(2)}, Alíquota efetiva ${comp.aliquotasEfetivas.total.toFixed(2)}%`, 'info');
        }

        if (dadosExtraidos.dadosFinanceiros) {
            const fin = dadosExtraidos.dadosFinanceiros;
            adicionarLogImportacao(`   💰 ${upper}: Margem operacional ${fin.resultado.margemOperacional.toFixed(2)}%`, 'info');
        }

        if (dadosExtraidos.cicloFinanceiro) {
            const ciclo = dadosExtraidos.cicloFinanceiro;
            adicionarLogImportacao(`   ⏱️ ${upper}: Ciclo financeiro ${ciclo.cicloFinanceiroLiquido} dias`, 'info');
        }

        if (dadosExtraidos.erros && dadosExtraidos.erros.length > 0) {
            adicionarLogImportacao(`   ⚠️ ${upper}: ${dadosExtraidos.erros.length} erro(s) na extração`, 'warning');
        }
    }

    /**
     * Log da consolidação de dados
     * @param {Object} dadosConsolidados - Dados consolidados
     */
    function logConsolidacao(dadosConsolidados) {
        if (!CONFIG.logDetalhado) return;

        adicionarLogImportacao(`📋 Consolidação concluída:`, 'info');
        
        if (dadosConsolidados.empresaInfo) {
            adicionarLogImportacao(`   🏢 Empresa: ${dadosConsolidados.empresaInfo.razaoSocial}`, 'info');
        }

        if (dadosConsolidados.composicaoTributaria) {
            const total = dadosConsolidados.composicaoTributaria.aliquotasEfetivas.total;
            adicionarLogImportacao(`   💼 Carga tributária consolidada: ${total.toFixed(2)}%`, 'info');
        }

        if (dadosConsolidados.transicaoTributaria) {
            const impacto = dadosConsolidados.transicaoTributaria.resumoTransicao.impactoTotal;
            adicionarLogImportacao(`   📈 Impacto estimado da transição: R$ ${impacto.toFixed(2)}`, 'info');
        }

        const observacoes = dadosConsolidados.observacoes || [];
        adicionarLogImportacao(`   ✓ ${observacoes.length} observação(ões) gerada(s)`, 'info');
    }

    /**
     * Notifica outros componentes sobre importação concluída
     * @param {Object} dadosConsolidados - Dados consolidados
     */
    function notificarImportacaoConcluida(dadosConsolidados) {
        // Evento customizado para outros módulos
        const evento = new CustomEvent('spedImportacaoConcluida', {
            detail: {
                dados: dadosConsolidados,
                estatisticas: gerarEstatisticasImportacao(),
                timestamp: new Date().toISOString()
            }
        });

        document.dispatchEvent(evento);

        // Atualizar outros componentes se disponíveis
        if (window.SimuladorFluxoCaixa && typeof window.SimuladorFluxoCaixa.atualizarComDadosSped === 'function') {
            window.SimuladorFluxoCaixa.atualizarComDadosSped(dadosConsolidados);
        }
    }

    /**
     * Gera estatísticas da importação
     * @returns {Object} Estatísticas detalhadas
     */
    function gerarEstatisticasImportacao() {
        return {
            arquivosCarregados: Object.keys(estadoImportacao.arquivosCarregados).length,
            arquivosProcessados: Object.keys(estadoImportacao.dadosProcessados).length,
            errosEncontrados: estadoImportacao.errosProcessamento.length,
            tempoProcessamento: estadoImportacao.progressoTotal === 100 ? 'Concluído' : 'Em andamento',
            tiposSpedImportados: Object.keys(estadoImportacao.dadosProcessados)
        };
    }

    /**
     * Formata tamanho de arquivo para exibição
     * @param {number} bytes - Tamanho em bytes
     * @returns {string} Tamanho formatado
     */
    function formatarTamanhoArquivo(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Exibe detalhes da importação (função global)
     */
    window.exibirDetalhesImportacao = function() {
        if (!window.dadosImportadosSped) {
            alert('Nenhum dado SPED foi importado ainda.');
            return;
        }

        // Criar modal ou painel com detalhes
        const detalhes = `
            Dados SPED Importados:
            
            📊 Estatísticas:
            - Arquivos processados: ${gerarEstatisticasImportacao().arquivosProcessados}
            - Tipos SPED: ${gerarEstatisticasImportacao().tiposSpedImportados.join(', ')}
            
            💼 Dados da Empresa:
            - Faturamento: R$ ${(window.dadosImportadosSped.empresa?.faturamento || 0).toFixed(2)}
            - Margem: ${((window.dadosImportadosSped.empresa?.margem || 0) * 100).toFixed(2)}%
            
            📈 Composição Tributária:
            - Alíquota efetiva total: ${((window.dadosImportadosSped.parametrosFiscais?.aliquota || 0) * 100).toFixed(2)}%
        `;

        alert(detalhes);
    };

    // Interface pública do módulo
    return {
        inicializar,
        iniciarProcessoImportacao,
        cancelarImportacao,
        limparEstadoImportacao,
        gerarEstatisticasImportacao,
        get estadoAtual() {
            return {
                status: estadoImportacao.statusAtual,
                progresso: estadoImportacao.progressoTotal,
                arquivos: Object.keys(estadoImportacao.arquivosCarregados),
                erros: estadoImportacao.errosProcessamento.length
            };
        }
    };
})();