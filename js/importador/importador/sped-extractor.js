/**
 * SpedExtractor - Módulo para extração de dados úteis para o simulador
 * a partir dos dados brutos extraídos pelo SpedParser
 */
const SpedExtractor = (function() {
    /**
     * Extrai dados relevantes para o simulador a partir dos dados SPED
     * @param {Object} dadosSped - Dados extraídos pelo SpedParser
     * @returns {Object} Objeto formatado para o simulador
     */
    function extrairDadosParaSimulador(dadosSped) {
        // Validar a estrutura dos dados de entrada
        if (!dadosSped || typeof dadosSped !== 'object') {
            console.error('Dados SPED inválidos ou não fornecidos');
            return {
                empresa: {},
                parametrosFiscais: { creditos: {} },
                cicloFinanceiro: {}
            };
        }

        // Extrai dados para formato canônico (estrutura aninhada)
        const dadosSimulador = {
            empresa: extrairDadosEmpresa(dadosSped),
            parametrosFiscais: extrairParametrosFiscais(dadosSped),
            cicloFinanceiro: extrairCicloFinanceiro(dadosSped),
            ivaConfig: extrairDadosIVA(dadosSped)
        };

        // Validar estrutura resultante
        return window.DataManager ? 
            window.DataManager.validarENormalizar(dadosSimulador) : 
            dadosSimulador;
    }

    /**
     * Extrai dados da empresa
     * @param {Object} dadosSped - Dados SPED
     * @returns {Object} Dados da empresa formatados
     */
    function extrairDadosEmpresa(dadosSped) {
        const empresa = dadosSped.empresa || {};
        const documentos = dadosSped.documentos || [];

        // Extrair faturamento mensal
        let faturamentoMensal = calcularFaturamentoMensal(dadosSped);

        // Extrair margem operacional
        let margemOperacional = calcularMargemOperacional(dadosSped);

        // Determinar tipo de empresa com base na atividade predominante
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);

        // Determinar regime tributário com base nas informações disponíveis
        const regimeTributario = determinarRegimeTributario(dadosSped);

        // Determinar setor para IVA Dual com base no CNAE
        const setorIVA = determinarSetorIVA(dadosSped);

        return {
            nome: empresa.nome || '',
            cnpj: empresa.cnpj || '',
            faturamento: faturamentoMensal,
            margem: margemOperacional,
            tipoEmpresa: tipoEmpresa,
            regime: regimeTributario,
            setor: setorIVA
        };
    }
    
    /**
     * Calcula o faturamento mensal com base nos dados SPED
     * @param {Object} dadosSped - Dados extraídos do SPED
     * @returns {number} Faturamento mensal estimado
     */
    function calcularFaturamentoMensal(dadosSped) {
        // Tenta obter faturamento pela ECD/ECF primeiro (mais preciso)
        if (dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
            // Converte faturamento anual para mensal
            return dadosSped.receitaBruta / 12;
        }

        // Alternativa: DRE da ECF
        if (dadosSped.dre && dadosSped.dre.receita_liquida) {
            return dadosSped.dre.receita_liquida.valor / 12;
        }

        // Se não encontrou na contabilidade, calcula pelos documentos fiscais
        const documentos = dadosSped.documentos || [];
        let faturamentoTotal = 0;
        let countDocumentosSaida = 0;
        let dataInicial = null;
        let dataFinal = null;

        documentos.forEach(doc => {
            if (doc.indOper === '1') { // Saída
                faturamentoTotal += doc.valorTotal || 0;
                countDocumentosSaida++;

                // Atualiza datas para calcular período
                const dataDoc = new Date(doc.dataEmissao.replace(/(\d{2})(\d{2})(\d{4})/, '$2/$1/$3'));

                if (!dataInicial || dataDoc < dataInicial) {
                    dataInicial = dataDoc;
                }

                if (!dataFinal || dataDoc > dataFinal) {
                    dataFinal = dataDoc;
                }
            }
        });

        // Se tiver documentos suficientes e período válido
        if (countDocumentosSaida > 1 && dataInicial && dataFinal) {
            const diasPeriodo = Math.max(1, (dataFinal - dataInicial) / (1000 * 60 * 60 * 24));
            const mesesPeriodo = Math.max(1, diasPeriodo / 30);
            return faturamentoTotal / mesesPeriodo;
        }

        // Faturamento básico para poucos documentos
        return countDocumentosSaida > 0 ? 
            faturamentoTotal / Math.max(1, Math.ceil(countDocumentosSaida / 30)) : 0;
    }

    /**
     * Calcula a margem operacional com base nos dados SPED
     * @param {Object} dadosSped - Dados extraídos do SPED
     * @returns {number} Margem operacional em decimal (0-1)
     */
    function calcularMargemOperacional(dadosSped) {
        // Tenta obter margem da ECD primeiro
        if (dadosSped.resultadoOperacional && dadosSped.receitaLiquida && 
            dadosSped.receitaLiquida > 0) {
            return dadosSped.resultadoOperacional / dadosSped.receitaLiquida;
        }

        // Alternativa: DRE da ECF
        if (dadosSped.dre && dadosSped.dre.resultado_operacional && 
            dadosSped.dre.receita_liquida) {
            return dadosSped.dre.resultado_operacional.valor / 
                   dadosSped.dre.receita_liquida.valor;
        }

        // Se não encontrou na contabilidade, estima pelos documentos fiscais
        // Neste caso, usamos uma estimativa básica baseada nos valores médios do setor
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);

        // Valores médios por setor (estimativas conservadoras)
        const margensPadrao = {
            'comercio': 0.08, // 8%
            'industria': 0.12, // 12%
            'servicos': 0.15  // 15%
        };

        return margensPadrao[tipoEmpresa] || 0.1; // 10% como padrão
    }

    /**
     * Determina o setor para IVA Dual com base no CNAE
     * @param {Object} dadosSped - Dados extraídos do SPED
     * @returns {string} Código do setor para o IVA Dual
     */
    function determinarSetorIVA(dadosSped) {
        let cnae = '';

        // Tenta obter CNAE da ECF
        if (dadosSped.ecf && dadosSped.ecf.dados && dadosSped.ecf.dados.cnae) {
            cnae = dadosSped.ecf.dados.cnae;
        }

        // Mapeamento de CNAEs para setores do IVA Dual
        // Esta é uma versão simplificada, o mapeamento real seria mais complexo
        const mapeamentoCNAE = {
            // Comércio
            '45': 'comercio_veiculos',
            '46': 'comercio_atacado',
            '47': 'comercio_varejo',
            // Indústria
            '10': 'industria_alimentos',
            '11': 'industria_bebidas',
            '13': 'industria_textil',
            // Serviços
            '49': 'transporte_terrestre',
            '50': 'transporte_aquaviario',
            '51': 'transporte_aereo',
            // Outros setores...
        };

        // Verifica os primeiros dois dígitos do CNAE
        if (cnae && cnae.length >= 2) {
            const prefixoCNAE = cnae.substring(0, 2);
            if (mapeamentoCNAE[prefixoCNAE]) {
                return mapeamentoCNAE[prefixoCNAE];
            }
        }

        // Se não conseguir determinar pelo CNAE, usa o tipo de empresa
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);

        // Mapeamento padrão por tipo de empresa
        const mapeamentoPadrao = {
            'comercio': 'comercio_varejo',
            'industria': 'industria_geral',
            'servicos': 'servicos_gerais'
        };

        return mapeamentoPadrao[tipoEmpresa] || 'comercio_varejo';
    }

    /**
     * Determina o tipo de empresa com base nos dados SPED
     * @param {Object} dadosSped - Dados SPED
     * @returns {string} Tipo de empresa (comercio, industria, servicos)
     */
    function determinarTipoEmpresa(dadosSped) {
        // Verificação direta de registros de IPI (forte indicativo de indústria)
        if (dadosSped.impostos && dadosSped.impostos.ipi && dadosSped.impostos.ipi.length > 0) {
            return 'industria';
        }

        // Se tiver informação da ECF, prioriza
        if (dadosSped.ecf && dadosSped.ecf.dados && dadosSped.ecf.dados.cnae) {
            const cnae = dadosSped.ecf.dados.cnae;

            // CNAEs típicos de cada atividade (primeiros 2 dígitos)
            // Indústria: 05-33
            // Comércio: 45-47
            // Serviços: 33-43, 49-99

            if (cnae.length >= 2) {
                const prefixoCNAE = parseInt(cnae.substring(0, 2), 10);

                if (prefixoCNAE >= 5 && prefixoCNAE <= 33) {
                    return 'industria';
                } else if (prefixoCNAE >= 45 && prefixoCNAE <= 47) {
                    return 'comercio';
                } else {
                    return 'servicos';
                }
            }
        }

        // Alternativa: análise dos CFOPs - Lista expandida
        const itens = dadosSped.itens || [];
        const cfops = new Set();

        // Coleta todos os CFOPs utilizados
        itens.forEach(item => {
            if (item.cfop) {
                cfops.add(item.cfop);
            }
        });

        // CFOPs típicos de indústria - Lista expandida
        const cfopsIndustria = [
            // Industrialização própria
            '5101', '5102', '5103', '5104', '5105', '5106', '5109',
            '6101', '6102', '6103', '6104', '6105', '6106', '6109',
            // Industrialização por encomenda
            '5124', '5125', '6124', '6125',
            // Retorno de industrialização
            '5901', '5902', '6901', '6902',
            // Venda de produto industrializado
            '5401', '5402', '5403', '5405',
            '6401', '6402', '6403', '6404', '6405'
        ];

        const cfopsServicos = [
            '5933', '5932', '5933', '6933', '6932', '9301', '9302',
            // Serviços de transporte e comunicação
            '5301', '5302', '5303', '5304', '5305', '5306', '5307',
            '6301', '6302', '6303', '6304', '6305', '6306', '6307'
        ];

        let countIndustria = 0;
        let countServicos = 0;
        let countComercio = 0;

        cfops.forEach(cfop => {
            if (cfopsIndustria.includes(cfop)) {
                countIndustria += 2; // Peso maior para CFOPs industriais
            } else if (cfopsServicos.includes(cfop)) {
                countServicos++;
            } else if (cfop.startsWith('5') || cfop.startsWith('6')) {
                countComercio++;
            }
        });

        // Verificação de títulos de itens/produtos que sugerem fabricação
        const termosFabricacao = ['produzido', 'fabricado', 'manufaturado', 'produção própria'];
        let countItensProducaoPropria = 0;

        (dadosSped.itens || []).forEach(item => {
            const descricao = (item.descricao || '').toLowerCase();
            if (termosFabricacao.some(termo => descricao.includes(termo))) {
                countItensProducaoPropria += 2; // Peso maior para itens de produção própria
            }
        });

        countIndustria += countItensProducaoPropria;

        // Determina tipo predominante com prioridade para indústria
        if (countIndustria > 0 && countIndustria >= Math.max(countComercio, countServicos)) {
            return 'industria';
        } else if (countServicos > countComercio) {
            return 'servicos';
        } else {
            return 'comercio';
        }
    }

    /**
     * Determina o regime tributário com base nos dados SPED
     * @param {Object} dadosSped - Dados SPED
     * @returns {string} Regime tributário (simples, presumido, real)
     */
    function determinarRegimeTributario(dadosSped) {
        // Verificação direta na ECF (mais precisa)
        if (dadosSped.ecf && dadosSped.ecf.parametros && dadosSped.ecf.parametros.formaApuracao) {
            const formaApuracao = dadosSped.ecf.parametros.formaApuracao;

            if (formaApuracao === '1' || formaApuracao === '2') {
                return 'real';
            } else if (formaApuracao === '3' || formaApuracao === '4') {
                return 'presumido';
            } else if (formaApuracao === '5' || formaApuracao === '6' || formaApuracao === '7') {
                // Entidades imunes/isentas normalmente usam regime por caixa similar ao Simples
                return 'simples';
            }
        }

        // Verifica regime PIS/COFINS no SPED Contribuições
        if (dadosSped.regimes && dadosSped.regimes.pis_cofins) {
            const codigoIncidencia = dadosSped.regimes.pis_cofins.codigoIncidencia;

            if (codigoIncidencia === '1') {
                // Exclusivamente não-cumulativo geralmente indica Lucro Real
                return 'real';
            } else if (codigoIncidencia === '2') {
                // Exclusivamente cumulativo geralmente indica Lucro Presumido
                return 'presumido';
            }
        }

        // Verifica se há informação explícita na empresa
        const empresa = dadosSped.empresa || {};

        if (empresa.regimeTributacao) {
            if (empresa.regimeTributacao === '1') return 'simples';
            if (empresa.regimeTributacao === '2') return 'presumido';
            if (empresa.regimeTributacao === '3') return 'real';
        }

        // Tenta inferir pelo padrão de tributos
        const impostos = dadosSped.impostos || {};
        const creditos = dadosSped.creditos || {};

        if (impostos.simples && impostos.simples.length > 0) {
            return 'simples';
        }

        // Verifica se há créditos de PIS/COFINS não-cumulativos
        if (creditos.pis && creditos.pis.length > 0 && creditos.cofins && creditos.cofins.length > 0) {
            // Verifica alíquotas para diferenciar presumido de real
            const pisSample = creditos.pis[0];
            if (pisSample.aliquotaPis > 1.0) {
                return 'real'; // Alíquotas maiores indicam não-cumulativo (Real)
            } else {
                return 'presumido';
            }
        }

        // Verifica com base nos registros analíticos (C190)
        if (dadosSped.itensAnaliticos && dadosSped.itensAnaliticos.length > 0) {
            // Análise de CSTs utilizados
            const csts = new Set();
            dadosSped.itensAnaliticos.forEach(item => {
                if (item.cstIcms) {
                    csts.add(item.cstIcms);
                }
            });

            // CSTs típicos do Simples: 101, 102, 103
            const cstsSimples = ['101', '102', '103', '300', '400'];

            for (const cst of cstsSimples) {
                if (csts.has(cst)) {
                    return 'simples';
                }
            }
        }

        return 'presumido'; // Valor padrão se não conseguir determinar
    }

    /**
     * Extrai parâmetros fiscais com estrutura otimizada para o painel detalhado
     * @param {Object} dadosSped - Dados SPED
     * @returns {Object} Parâmetros fiscais formatados com composição detalhada
     */
    function extrairParametrosFiscais(dadosSped) {
        const impostos = dadosSped.impostos || {};
        const creditos = dadosSped.creditos || {};
        const debitos = dadosSped.debitos || {};
        const regimeTributario = determinarRegimeTributario(dadosSped);
        const ajustes = dadosSped.ajustes || {};
        const itensAnaliticos = dadosSped.itensAnaliticos || [];

        // Detectar incentivos fiscais
        const incentivosICMS = detectarIncentivosICMS(dadosSped);

        // Calcular alíquotas e bases efetivas
        const dadosICMS = calcularAliquotaEfetivaICMS(dadosSped);
        const dadosPisCofins = calcularDadosPisCofins(dadosSped);
        const dadosIPI = calcularDadosIPI(dadosSped);
        const dadosISS = calcularDadosISS(dadosSped);

        // Determinar tipo de operação (B2B vs B2C)
        const tipoOperacao = determinarTipoOperacao(dadosSped);

        // Calcular faturamento mensal para base de cálculo das alíquotas efetivas
        const faturamentoMensal = calcularFaturamentoMensal(dadosSped);

        // ESTRUTURA PRINCIPAL: Organizada para alimentar o painel detalhado
        const parametros = {
            // Dados básicos do regime
            tipoOperacao: tipoOperacao,
            regimePisCofins: dadosPisCofins.regime,
            regime: regimeTributario,

            // NOVA SEÇÃO: Composição tributária detalhada (prioridade para painel)
            composicaoTributaria: {
                // Débitos mensais por imposto
                debitos: {
                    pis: calcularDebitosPIS(dadosSped),
                    cofins: calcularDebitosCOFINS(dadosSped),
                    icms: calcularDebitosICMS(dadosSped),
                    ipi: calcularDebitosIPI(dadosSped),
                    iss: calcularDebitosISS(dadosSped)
                },

                // Créditos mensais por imposto
                creditos: {
                    pis: calcularCreditosPIS(dadosSped),
                    cofins: calcularCreditosCOFINS(dadosSped),
                    icms: calcularCreditosICMS(dadosSped),
                    ipi: calcularCreditosIPI(dadosSped),
                    iss: 0 // ISS não gera créditos
                },

                // Alíquotas efetivas calculadas - CORREÇÃO PRINCIPAL
                aliquotasEfetivas: {},

                // Metadados para validação
                fontesDados: {
                    pis: debitos.pis && debitos.pis.length > 0 ? 'sped' : 'estimado',
                    cofins: debitos.cofins && debitos.cofins.length > 0 ? 'sped' : 'estimado',
                    icms: impostos.icms && impostos.icms.length > 0 ? 'sped' : 'estimado',
                    ipi: impostos.ipi && impostos.ipi.length > 0 ? 'sped' : 'estimado',
                    iss: 'estimado' // ISS não consta no SPED
                },

                // Período de referência dos dados
                periodoReferencia: {
                    dataInicial: dadosSped.empresa?.dataInicial || null,
                    dataFinal: dadosSped.empresa?.dataFinal || null,
                    mesesAnalisados: calcularMesesAnalisados(dadosSped)
                }
            },

            // Dados complementares (mantidos para compatibilidade)
            creditos: {
                pis: calcularCreditosPIS(dadosSped),
                cofins: calcularCreditosCOFINS(dadosSped),
                icms: calcularCreditosICMS(dadosSped),
                ipi: calcularCreditosIPI(dadosSped),
                cbs: 0,
                ibs: 0
            },

            // Dados de configuração específica por imposto
            configuracaoImpostos: {
                icms: {
                    possuiIncentivo: incentivosICMS.possuiIncentivo,
                    percentualReducao: incentivosICMS.percentualReducao / 100,
                    aliquotaEfetiva: dadosICMS.aliquotaEfetiva / 100,
                    baseCalculo: dadosICMS.percentualBase / 100,
                    percAproveitamento: dadosICMS.percentualAproveitamento / 100
                },
                ipi: {
                    aliquotaMedia: dadosIPI.aliquotaMedia / 100,
                    baseCalculo: dadosIPI.percentualBase / 100,
                    percAproveitamento: dadosIPI.percentualAproveitamento / 100
                },
                iss: {
                    aliquotaMedia: dadosISS.aliquotaMedia / 100
                },
                pisCofins: {
                    baseCalculo: dadosPisCofins.percentualBase / 100,
                    percAproveitamento: dadosPisCofins.percentualAproveitamento / 100
                }
            }
        };

        // CORREÇÃO CRÍTICA: Calcular alíquotas efetivas baseadas em (débitos - créditos)/faturamento
        if (faturamentoMensal > 0) {
            const creditosPIS = parametros.composicaoTributaria.creditos.pis;
            const creditosCOFINS = parametros.composicaoTributaria.creditos.cofins;
            const creditosICMS = parametros.composicaoTributaria.creditos.icms;
            const creditosIPI = parametros.composicaoTributaria.creditos.ipi;
            const creditosISS = 0; // ISS não gera créditos

            const debitosPIS = parametros.composicaoTributaria.debitos.pis;
            const debitosCOFINS = parametros.composicaoTributaria.debitos.cofins;
            const debitosICMS = parametros.composicaoTributaria.debitos.icms;
            const debitosIPI = parametros.composicaoTributaria.debitos.ipi;
            const debitosISS = parametros.composicaoTributaria.debitos.iss;

            // Cálculo correto: (débitos - créditos) / faturamento
            const impostoLiquidoPIS = Math.max(0, debitosPIS - creditosPIS);
            const impostoLiquidoCOFINS = Math.max(0, debitosCOFINS - creditosCOFINS);
            const impostoLiquidoICMS = Math.max(0, debitosICMS - creditosICMS);
            const impostoLiquidoIPI = Math.max(0, debitosIPI - creditosIPI);
            const impostoLiquidoISS = Math.max(0, debitosISS - creditosISS);

            const totalImpostoLiquido = impostoLiquidoPIS + impostoLiquidoCOFINS + 
                                      impostoLiquidoICMS + impostoLiquidoIPI + impostoLiquidoISS;

            parametros.composicaoTributaria.aliquotasEfetivas = {
                pis: (impostoLiquidoPIS / faturamentoMensal) * 100,
                cofins: (impostoLiquidoCOFINS / faturamentoMensal) * 100,
                icms: (impostoLiquidoICMS / faturamentoMensal) * 100,
                ipi: (impostoLiquidoIPI / faturamentoMensal) * 100,
                iss: (impostoLiquidoISS / faturamentoMensal) * 100,
                total: (totalImpostoLiquido / faturamentoMensal) * 100
            };

            // Log para diagnóstico
            console.log('SPED-EXTRACTOR: Alíquotas efetivas calculadas:', {
                faturamentoMensal: faturamentoMensal,
                debitos: parametros.composicaoTributaria.debitos,
                creditos: parametros.composicaoTributaria.creditos,
                impostoLiquido: {
                    pis: impostoLiquidoPIS,
                    cofins: impostoLiquidoCOFINS,
                    icms: impostoLiquidoICMS,
                    ipi: impostoLiquidoIPI,
                    iss: impostoLiquidoISS,
                    total: totalImpostoLiquido
                },
                aliquotasEfetivas: parametros.composicaoTributaria.aliquotasEfetivas
            });
        } else {
            parametros.composicaoTributaria.aliquotasEfetivas = {
                pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0, total: 0
            };
        }

        return parametros;
    }

    /**
     * Calcula o número de meses analisados no SPED
     * @param {Object} dadosSped - Dados SPED
     * @returns {number} Número de meses
     */
    function calcularMesesAnalisados(dadosSped) {
        if (!dadosSped.empresa?.dataInicial || !dadosSped.empresa?.dataFinal) {
            return 12; // Assume ano completo se não tiver datas
        }

        const dataInicial = new Date(dadosSped.empresa.dataInicial);
        const dataFinal = new Date(dadosSped.empresa.dataFinal);

        const diffTime = Math.abs(dataFinal - dataInicial);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return Math.max(1, Math.round(diffDays / 30));
    }
    
    /**
     * Detecta incentivos fiscais de ICMS
     * @param {Object} dadosSped - Dados SPED
     * @returns {Object} Informações sobre incentivos
     */
    function detectarIncentivosICMS(dadosSped) {
        const resultado = {
            possuiIncentivo: false,
            percentualReducao: 0,
            valorTotal: 0,
            tiposIncentivo: []
        };

        // Verifica ajustes específicos de ICMS (E111)
        if (dadosSped.ajustes && dadosSped.ajustes.icms) {
            const ajustesICMS = dadosSped.ajustes.icms;

            // Códigos de ajuste que tipicamente indicam incentivos
            const codigosIncentivos = [
                'SP020100', 'PR020100', 'MG20100', 'RJ020130', // Exemplos de códigos
                'IC', 'IN'  // Prefixos comuns para incentivos
            ];

            let valorTotalAjustes = 0;
            let countIncentivos = 0;

            for (const ajuste of ajustesICMS) {
                // Verifica se o código está na lista ou contém prefixos comuns
                const codigoAjuste = ajuste.codigoAjuste || '';
                const descricao = (ajuste.descricaoComplementar || '').toLowerCase();

                const isIncentivo = 
                    codigosIncentivos.some(codigo => codigoAjuste.includes(codigo)) ||
                    descricao.includes('incentiv') || 
                    descricao.includes('benefício') ||
                    descricao.includes('reducao') ||
                    descricao.includes('crédito presumido');

                if (isIncentivo) {
                    resultado.possuiIncentivo = true;
                    resultado.valorTotal += ajuste.valorAjuste || 0;
                    resultado.tiposIncentivo.push({
                        codigo: codigoAjuste,
                        descricao: ajuste.descricaoComplementar,
                        valor: ajuste.valorAjuste || 0
                    });
                    countIncentivos++;
                }

                valorTotalAjustes += Math.abs(ajuste.valorAjuste || 0);
            }

            // Calcula o percentual de redução
            if (resultado.possuiIncentivo && valorTotalAjustes > 0) {
                resultado.percentualReducao = (resultado.valorTotal / valorTotalAjustes) * 100;
            }
        }

        // Verifica informações de incentivos na ECF
        if (dadosSped.incentivosFiscais && dadosSped.incentivosFiscais.length > 0) {
            resultado.possuiIncentivo = true;

            // Soma incentivos relacionados a ICMS
            const incentivosICMSECF = dadosSped.incentivosFiscais.filter(inc => 
                (inc.descricaoIncentivo || '').toLowerCase().includes('icms')
            );

            incentivosICMSECF.forEach(inc => {
                resultado.valorTotal += inc.valorIncentivo || 0;
                resultado.tiposIncentivo.push({
                    codigo: inc.codIncentivo,
                    descricao: inc.descricaoIncentivo,
                    valor: inc.valorIncentivo || 0
                });
            });

            // Se não encontrou percentual nos ajustes, estima com base no valor total do ICMS
            if (resultado.percentualReducao === 0 && dadosSped.impostos && dadosSped.impostos.icms) {
                const valorICMSTotal = dadosSped.impostos.icms.reduce((sum, imp) => 
                    sum + (imp.valorTotalDebitos || 0), 0);

                if (valorICMSTotal > 0) {
                    resultado.percentualReducao = (resultado.valorTotal / valorICMSTotal) * 100;
                }
            }
        }

        return resultado;
    }

    /**
     * Calcula a alíquota efetiva de ICMS e dados relacionados
     * @param {Object} dadosSped - Dados SPED
     * @returns {Object} Informações sobre ICMS
     */
    function calcularAliquotaEfetivaICMS(dadosSped) {
        const resultado = {
            aliquotaEfetiva: 18.0, // Valor padrão
            percentualBase: 60.0,  // Valor padrão
            percentualAproveitamento: 100.0, // Valor padrão
            valorTotalDebitos: 0,
            valorTotalCreditos: 0
        };

        // Cálculo baseado em registros analíticos (C190)
        if (dadosSped.itensAnaliticos && dadosSped.itensAnaliticos.length > 0) {
            const itensVenda = dadosSped.itensAnaliticos.filter(item => 
                item.categoria === 'icms' && 
                (item.cfop.startsWith('5') || item.cfop.startsWith('6'))
            );

            if (itensVenda.length > 0) {
                let valorOperacaoTotal = 0;
                let valorBaseCalculoTotal = 0;
                let valorICMSTotal = 0;

                itensVenda.forEach(item => {
                    valorOperacaoTotal += item.valorOperacao || 0;
                    valorBaseCalculoTotal += item.valorBaseCalculo || 0;
                    valorICMSTotal += item.valorIcms || 0;
                });

                if (valorBaseCalculoTotal > 0) {
                    // Alíquota efetiva = Valor ICMS / Base de Cálculo
                    resultado.aliquotaEfetiva = (valorICMSTotal / valorBaseCalculoTotal) * 100;
                }

                if (valorOperacaoTotal > 0) {
                    // Percentual da base = Base de Cálculo / Valor da Operação
                    resultado.percentualBase = (valorBaseCalculoTotal / valorOperacaoTotal) * 100;
                }

                resultado.valorTotalDebitos = valorICMSTotal;
            }
        }

        // Calcula o percentual de aproveitamento com base na apuração (E110)
        if (dadosSped.impostos && dadosSped.impostos.icms) {
            dadosSped.impostos.icms.forEach(apuracao => {
                resultado.valorTotalCreditos += apuracao.valorTotalCreditos || 0;
            });

            // Percentual de aproveitamento baseado na relação crédito/débito
            if (resultado.valorTotalDebitos > 0) {
                const relacaoCreditos = resultado.valorTotalCreditos / resultado.valorTotalDebitos;

                // Limita entre 0 e 100%
                resultado.percentualAproveitamento = Math.min(100, relacaoCreditos * 100);
            }
        }

        return resultado;
    }

    /**
     * Calcula dados de PIS/COFINS
     * @param {Object} dadosSped - Dados SPED
     * @returns {Object} Informações sobre PIS/COFINS
     */
    function calcularDadosPisCofins(dadosSped) {
        const resultado = {
            regime: 'cumulativo', // Valor padrão
            percentualBase: 50.0,  // Valor padrão
            percentualAproveitamento: 100.0 // Valor padrão
        };

        // Determina o regime com base no registro 0110
        if (dadosSped.regimes && dadosSped.regimes.pis_cofins) {
            const regimePisCofins = dadosSped.regimes.pis_cofins;

            if (regimePisCofins.codigoIncidencia === '1') {
                resultado.regime = 'nao-cumulativo';
            } else if (regimePisCofins.codigoIncidencia === '2') {
                resultado.regime = 'cumulativo';
            } else if (regimePisCofins.codigoIncidencia === '3') {
                // Regime misto - determina o predominante
                resultado.regime = 'nao-cumulativo'; // Por padrão, considera não-cumulativo

                // Análise mais detalhada para determinar o predominante
                if (dadosSped.creditos && dadosSped.creditos.pis && dadosSped.creditos.cofins) {
                    // Conta quantos créditos de cada tipo
                    let countCumulativo = 0;
                    let countNaoCumulativo = 0;

                    // PIS
                    dadosSped.creditos.pis.forEach(credito => {
                        const aliquota = credito.aliquotaPis || 0;
                        if (aliquota <= 0.65) countCumulativo++;
                        else countNaoCumulativo++;
                    });

                    // COFINS
                    dadosSped.creditos.cofins.forEach(credito => {
                        const aliquota = credito.aliquotaCofins || 0;
                        if (aliquota <= 3.0) countCumulativo++;
                        else countNaoCumulativo++;
                    });

                    if (countCumulativo > countNaoCumulativo) {
                        resultado.regime = 'cumulativo';
                    }
                }
            }
        } else {
            // Tenta inferir pelo regime tributário
            const regimeTributario = determinarRegimeTributario(dadosSped);

            if (regimeTributario === 'real') {
                resultado.regime = 'nao-cumulativo';
            } else {
                resultado.regime = 'cumulativo';
            }
        }

        // Calcula o percentual da base de cálculo
        if (dadosSped.creditos && dadosSped.creditos.pis && dadosSped.creditos.pis.length > 0) {
            let baseCalculoTotal = 0;

            dadosSped.creditos.pis.forEach(credito => {
                baseCalculoTotal += credito.baseCalculoCredito || 0;
            });

            if (dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
                resultado.percentualBase = (baseCalculoTotal / dadosSped.receitaBruta) * 100;
            } else if (baseCalculoTotal > 0) {
                // Estimativa com base na relação típica entre base de cálculo e valor
                const creditosM100 = dadosSped.creditos.pis.filter(c => c.tipo === 'credito');

                if (creditosM100.length > 0) {
                    const valorCreditoTotal = creditosM100.reduce((sum, c) => sum + (c.valorCredito || 0), 0);

                    if (valorCreditoTotal > 0) {
                        const aliquotaMedia = resultado.regime === 'nao-cumulativo' ? 1.65 : 0.65;
                        const receitaEstimada = baseCalculoTotal / (aliquotaMedia / 100);

                        // Percentual de aproveitamento
                        resultado.percentualAproveitamento = 
                            (valorCreditoTotal / (baseCalculoTotal * (aliquotaMedia / 100))) * 100;
                    }
                }
            }
        }

        return resultado;
    }

    /**
     * Calcula dados de IPI
     * @param {Object} dadosSped - Dados SPED
     * @returns {Object} Informações sobre IPI
     */
    function calcularDadosIPI(dadosSped) {
        const resultado = {
            aliquotaMedia: 10.0, // Valor padrão
            percentualBase: 40.0, // Valor padrão
            percentualAproveitamento: 100.0 // Valor padrão
        };

        // Calcula alíquota com base nos itens
        if (dadosSped.itens && dadosSped.itens.length > 0) {
            // Itens que têm IPI
            const itensComIPI = dadosSped.itens.filter(item => 
                item.valorIpi && item.valorIpi > 0 && item.valorItem > 0
            );

            if (itensComIPI.length > 0) {
                let valorTotalItens = 0;
                let valorTotalIPI = 0;

                itensComIPI.forEach(item => {
                    valorTotalItens += item.valorItem || 0;
                    valorTotalIPI += item.valorIpi || 0;
                });

                if (valorTotalItens > 0) {
                    resultado.aliquotaMedia = (valorTotalIPI / valorTotalItens) * 100;

                    // Percentual da base (estima-se como 100% para IPI)
                    resultado.percentualBase = 100.0;
                }
            }
        }

        // Para o percentual de aproveitamento, verificamos com base nas compras
        if (dadosSped.impostos && dadosSped.impostos.ipi) {
            let valorDebitosIPI = 0;
            let valorCreditosIPI = 0;

            dadosSped.impostos.ipi.forEach(ipi => {
                valorDebitosIPI += ipi.valorTotalDebitos || 0;
                valorCreditosIPI += ipi.valorCredito || 0;
            });

            if (valorDebitosIPI > 0) {
                resultado.percentualAproveitamento = (valorCreditosIPI / valorDebitosIPI) * 100;
            }
        }

        return resultado;
    }

    /**
     * Calcula dados de ISS
     * @param {Object} dadosSped - Dados SPED
     * @returns {Object} Informações sobre ISS
     */
    function calcularDadosISS(dadosSped) {
        // Como o ISS não está no SPED, usamos valores padrão ou estimativas
        const resultado = {
            aliquotaMedia: 5.0 // Valor padrão
        };

        // Verificamos o município para estimar a alíquota
        if (dadosSped.empresa && dadosSped.empresa.municipio) {
            const municipio = dadosSped.empresa.municipio;

            // Alíquotas típicas por município (exemplos)
            const aliquotasPorMunicipio = {
                'SAO PAULO': 5.0,
                'RIO DE JANEIRO': 5.0,
                'BELO HORIZONTE': 5.0,
                'BRASILIA': 5.0,
                'CURITIBA': 5.0,
                'SALVADOR': 5.0,
                'FORTALEZA': 5.0,
                'RECIFE': 5.0,
                'PORTO ALEGRE': 5.0,
                'MANAUS': 5.0,
                'GOIANIA': 5.0,
                'BELEM': 5.0,
                'SAO LUIS': 5.0,
                'MACEIO': 5.0,
                'CAMPO GRANDE': 5.0,
                'TERESINA': 5.0,
                'JOAO PESSOA': 5.0,
                'NATAL': 5.0,
                'ARACAJU': 5.0,
                'FLORIANOPOLIS': 5.0,
                'CUIABA': 5.0,
                'PORTO VELHO': 5.0,
                'MACAPA': 5.0,
                'BOA VISTA': 5.0,
                'RIO BRANCO': 5.0,
                'VITORIA': 5.0,
                'PALMAS': 5.0,
                'GUARULHOS': 5.0,
                'CAMPINAS': 5.0,
                'SAO GONCALO': 5.0,
                // Outros municípios...
            };

            if (aliquotasPorMunicipio[municipio.toUpperCase()]) {
                resultado.aliquotaMedia = aliquotasPorMunicipio[municipio.toUpperCase()];
            }
        }

        return resultado;
    }

    /**
     * Determina o tipo de operação (B2B, B2C, mista)
     * @param {Object} dadosSped - Dados SPED
     * @returns {string} Tipo de operação
     */
    function determinarTipoOperacao(dadosSped) {
        // Se não houver documentos suficientes, retorna um valor padrão
        if (!dadosSped.documentos || dadosSped.documentos.length < 5) {
            return 'b2b'; // Padrão conservador
        }

        // Apenas documentos de saída
        const documentosSaida = dadosSped.documentos.filter(doc => 
            doc.indOper === '1' // Saída
        );

        if (documentosSaida.length === 0) {
            return 'b2b';
        }

        let countB2B = 0;
        let countB2C = 0;

        // Analisa os participantes para detectar se são empresas ou consumidores
        documentosSaida.forEach(doc => {
            // Se tiver participante com CNPJ, é B2B
            if (doc.participante && doc.participante.cnpjCpf) {
                if (doc.participante.cnpjCpf.length === 14) {
                    countB2B++;
                } else {
                    countB2C++;
                }
            } else if (doc.modelo) {
                // Modelos típicos de NFC-e (B2C): 65
                // Modelos típicos de NF-e (B2B): 55
                if (doc.modelo === '65') {
                    countB2C++;
                } else if (doc.modelo === '55') {
                    countB2B++;
                }
            }
        });

        const totalDocs = countB2B + countB2C;

        if (totalDocs === 0) {
            return 'b2b';
        }

        const percentB2B = (countB2B / totalDocs) * 100;

        if (percentB2B > 80) {
            return 'b2b';
        } else if (percentB2B < 20) {
            return 'b2c';
        } else {
            return 'mista';
        }
    }

    /**
     * Calcula créditos de PIS
     * @param {Object} dadosSped - Dados SPED
     * @returns {number} Valor dos créditos de PIS
     */
    function calcularCreditosPIS(dadosSped) {
        let valorCreditos = 0;
        let fonteUtilizada = 'estimado';
        let detalhamento = {
            spedDireto: 0,
            spedCalculado: 0,
            registrosDetalhados: 0
        };

        // PRIORIDADE 1: Registros M100/M105 do SPED Contribuições
        if (dadosSped.creditos && dadosSped.creditos.pis && Array.isArray(dadosSped.creditos.pis)) {
            dadosSped.creditos.pis.forEach(credito => {
                if (credito.valorCredito && credito.valorCredito > 0) {
                    detalhamento.spedDireto += credito.valorCredito;
                    fonteUtilizada = 'sped_direto';
                }
                // Para registros M105 (detalhe de créditos)
                if (credito.baseCalculoCredito && credito.aliquotaCredito) {
                    const creditoCalculado = credito.baseCalculoCredito * (credito.aliquotaCredito / 100);
                    detalhamento.spedCalculado += creditoCalculado;
                    fonteUtilizada = 'sped_calculado';
                }
            });
        }

        // PRIORIDADE 2: Buscar em registros detalhados M100/M105
        ['M100', 'M105'].forEach(tipoRegistro => {
            if (dadosSped.creditos && dadosSped.creditos[tipoRegistro] && Array.isArray(dadosSped.creditos[tipoRegistro])) {
                dadosSped.creditos[tipoRegistro].forEach(registro => {
                    if (registro.categoria === 'pis' || registro.codigoCredito) {
                        if (registro.valorCredito && registro.valorCredito > 0) {
                            detalhamento.registrosDetalhados += registro.valorCredito;
                            fonteUtilizada = 'sped_registro_' + tipoRegistro;
                        }
                        if (registro.baseCalculoCredito && registro.aliquotaCredito) {
                            detalhamento.registrosDetalhados += registro.baseCalculoCredito * (registro.aliquotaCredito / 100);
                            fonteUtilizada = 'sped_registro_' + tipoRegistro;
                        }
                    }
                });
            }
        });

        // Calcular valor final
        valorCreditos = detalhamento.spedDireto + detalhamento.spedCalculado + detalhamento.registrosDetalhados;

        // PRIORIDADE 3: Estimativa baseada no regime se não encontrou dados
        if (valorCreditos === 0) {
            const regime = determinarRegimeTributario(dadosSped);
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped) * 12;

            if (regime === 'real' || regime === 'presumido') {
                const aliquotaPIS = regime === 'real' ? 0.0165 : 0.0065;
                const baseCalculoEstimada = faturamentoAnual * 0.6;
                const aproveitamentoEstimado = 0.8;

                valorCreditos = (baseCalculoEstimada * aliquotaPIS * aproveitamentoEstimado) / 12;
                fonteUtilizada = 'estimado_' + regime;
            }
        }

        // Log detalhado para diagnóstico
        console.log('SPED-EXTRACTOR: Créditos PIS calculados:', {
            valorCreditos: valorCreditos,
            fonteUtilizada: fonteUtilizada,
            detalhamento: detalhamento,
            registrosEncontrados: dadosSped.creditos?.pis?.length || 0,
            regime: determinarRegimeTributario(dadosSped)
        });

        return valorCreditos;
    }

    /**
     * Calcula créditos de COFINS
     * @param {Object} dadosSped - Dados SPED
     * @returns {number} Valor dos créditos de COFINS
     */
    function calcularCreditosCOFINS(dadosSped) {
        let valorCreditos = 0;
        let fonteUtilizada = 'estimado';
        let detalhamento = {
            spedDireto: 0,
            spedCalculado: 0,
            registrosDetalhados: 0
        };

        // PRIORIDADE 1: Registros M500/M505 do SPED Contribuições
        if (dadosSped.creditos && dadosSped.creditos.cofins && Array.isArray(dadosSped.creditos.cofins)) {
            dadosSped.creditos.cofins.forEach(credito => {
                if (credito.valorCredito && credito.valorCredito > 0) {
                    detalhamento.spedDireto += credito.valorCredito;
                    fonteUtilizada = 'sped_direto';
                }
                // Para registros M505 (detalhe de créditos)
                if (credito.baseCalculoCredito && credito.aliquotaCredito) {
                    const creditoCalculado = credito.baseCalculoCredito * (credito.aliquotaCredito / 100);
                    detalhamento.spedCalculado += creditoCalculado;
                    fonteUtilizada = 'sped_calculado';
                }
            });
        }

        // PRIORIDADE 2: Buscar em registros detalhados M500/M505
        ['M500', 'M505'].forEach(tipoRegistro => {
            if (dadosSped.creditos && dadosSped.creditos[tipoRegistro] && Array.isArray(dadosSped.creditos[tipoRegistro])) {
                dadosSped.creditos[tipoRegistro].forEach(registro => {
                    if (registro.categoria === 'cofins' || registro.codigoCredito) {
                        if (registro.valorCredito && registro.valorCredito > 0) {
                            detalhamento.registrosDetalhados += registro.valorCredito;
                            fonteUtilizada = 'sped_registro_' + tipoRegistro;
                        }
                        if (registro.baseCalculoCredito && registro.aliquotaCredito) {
                            detalhamento.registrosDetalhados += registro.baseCalculoCredito * (registro.aliquotaCredito / 100);
                            fonteUtilizada = 'sped_registro_' + tipoRegistro;
                        }
                    }
                });
            }
        });

        // Calcular valor final
        valorCreditos = detalhamento.spedDireto + detalhamento.spedCalculado + detalhamento.registrosDetalhados;

        // PRIORIDADE 3: Estimativa baseada no regime se não encontrou dados
        if (valorCreditos === 0) {
            const regime = determinarRegimeTributario(dadosSped);
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped) * 12;

            if (regime === 'real' || regime === 'presumido') {
                const aliquotaCOFINS = regime === 'real' ? 0.076 : 0.03;
                const baseCalculoEstimada = faturamentoAnual * 0.6;
                const aproveitamentoEstimado = 0.8;

                valorCreditos = (baseCalculoEstimada * aliquotaCOFINS * aproveitamentoEstimado) / 12;
                fonteUtilizada = 'estimado_' + regime;
            }
        }

        // Log detalhado para diagnóstico
        console.log('SPED-EXTRACTOR: Créditos COFINS calculados:', {
            valorCreditos: valorCreditos,
            fonteUtilizada: fonteUtilizada,
            detalhamento: detalhamento,
            registrosEncontrados: dadosSped.creditos?.cofins?.length || 0,
            regime: determinarRegimeTributario(dadosSped)
        });

        return valorCreditos;
    }

    /**
     * Calcula créditos de ICMS
     * @param {Object} dadosSped - Dados SPED
     * @returns {number} Valor dos créditos de ICMS
     */
    function calcularCreditosICMS(dadosSped) {
        let valorCreditos = 0;
        let fonteUtilizada = 'estimado';

        // PRIORIDADE 1: Apuração ICMS (registros E110) - valorTotalCreditos
        if (dadosSped.debitos && dadosSped.debitos.icms && Array.isArray(dadosSped.debitos.icms)) {
            dadosSped.debitos.icms.forEach(apuracao => {
                valorCreditos += apuracao.valorTotalCreditos || 0; // CORRETO: créditos
                fonteUtilizada = 'sped_e110_debitos';
            });
        }

        // Fallback: verificar se os dados estão em impostos (compatibilidade)
        if (valorCreditos === 0 && dadosSped.impostos && dadosSped.impostos.icms && Array.isArray(dadosSped.impostos.icms)) {
            dadosSped.impostos.icms.forEach(apuracao => {
                valorCreditos += apuracao.valorTotalCreditos || 0; // CORRETO: créditos
                fonteUtilizada = 'sped_e110_impostos';
            });
        }

        // PRIORIDADE 2: Registros analíticos C190 (créditos de entradas)
        if (valorCreditos === 0 && dadosSped.itensAnaliticos && Array.isArray(dadosSped.itensAnaliticos)) {
            const itensEntrada = dadosSped.itensAnaliticos.filter(item => 
                item.categoria === 'icms' && 
                (item.cfop.startsWith('1') || item.cfop.startsWith('2')) && // Entradas
                item.valorIcms > 0
            );

            valorCreditos = itensEntrada.reduce((total, item) => {
                return total + (item.valorIcms || 0);
            }, 0);

            if (valorCreditos > 0) {
                fonteUtilizada = 'sped_c190_analiticos';
            }
        }

        // PRIORIDADE 3: Buscar créditos em estrutura de créditos se existir
        if (valorCreditos === 0 && dadosSped.creditos && dadosSped.creditos.icms && Array.isArray(dadosSped.creditos.icms)) {
            dadosSped.creditos.icms.forEach(credito => {
                valorCreditos += credito.valorCredito || credito.valorIcms || 0;
                fonteUtilizada = 'sped_creditos_icms';
            });
        }

        // Estimativa baseada no faturamento se não encontrou dados
        if (valorCreditos === 0) {
            const tipoEmpresa = determinarTipoEmpresa(dadosSped);

            if (tipoEmpresa !== 'servicos') {
                const faturamento = calcularFaturamentoMensal(dadosSped) * 12;
                const aliquotaMedia = 0.18;
                const baseCalculoCompras = faturamento * 0.7; // 70% do faturamento em compras
                const aproveitamentoICMS = 0.85; // 85% de aproveitamento típico

                valorCreditos = (baseCalculoCompras * aliquotaMedia * aproveitamentoICMS) / 12;
                fonteUtilizada = 'estimado_' + tipoEmpresa;
            }
        }

        // Log detalhado
        console.log('SPED-EXTRACTOR: Créditos ICMS calculados:', {
            valorCreditos: valorCreditos,
            fonteUtilizada: fonteUtilizada,
            registrosEncontrados: {
                e110_debitos: dadosSped.debitos?.icms?.length || 0,
                e110_impostos: dadosSped.impostos?.icms?.length || 0,
                c190_analiticos: dadosSped.itensAnaliticos ? 
                    dadosSped.itensAnaliticos.filter(i => i.categoria === 'icms').length : 0,
                creditos_icms: dadosSped.creditos?.icms?.length || 0
            }
        });

        return valorCreditos;
    }

    /**
     * Calcula créditos de IPI
     * @param {Object} dadosSped - Dados SPED
     * @returns {number} Valor dos créditos de IPI
     */
    function calcularCreditosIPI(dadosSped) {
        let valorCreditos = 0;

        // Verificar se é indústria (IPI só se aplica à indústria)
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'industria') {
            return 0;
        }

        // Primeira fonte: apuração IPI
        if (dadosSped.impostos && dadosSped.impostos.ipi && Array.isArray(dadosSped.impostos.ipi)) {
            dadosSped.impostos.ipi.forEach(apuracao => {
                valorCreditos += apuracao.valorCredito || 0;
            });
        }

        // Segunda fonte: itens de entrada com IPI
        if (valorCreditos === 0 && dadosSped.itens && Array.isArray(dadosSped.itens)) {
            const itensComIPI = dadosSped.itens.filter(item => 
                item.valorIpi && item.valorIpi > 0 &&
                item.cfop && (item.cfop.startsWith('1') || item.cfop.startsWith('2')) // Entradas
            );

            valorCreditos = itensComIPI.reduce((total, item) => {
                return total + (item.valorIpi || 0);
            }, 0);
        }

        // Estimativa baseada no faturamento
        if (valorCreditos === 0) {
            const faturamento = calcularFaturamentoMensal(dadosSped) * 12;
            const aliquotaMediaIPI = 0.10;
            const baseCalculoCompras = faturamento * 0.4; // 40% para matérias-primas
            const aproveitamentoIPI = 0.90; // 90% de aproveitamento

            valorCreditos = baseCalculoCompras * aliquotaMediaIPI * aproveitamentoIPI;
        }

        return valorCreditos / 12; // Retorna valor mensal
    }
    
    /**
     * Calcula débitos de PIS considerando TODOS os ajustes extra-apuração
     * @param {Object} dadosSped - Dados extraídos do SPED
     * @returns {number} Valor total dos débitos de PIS (incluindo ajustes)
     */
    function calcularDebitosPIS(dadosSped) {
        let valorDebitos = 0;
        let fonteUtilizada = 'estimado';
        let detalhamento = {
            consolidacao: 0,
            ajustes: 0,
            detalhamento: 0,
            total: 0
        };

        // PRIORIDADE 1: Registro M200 (Consolidação)
        if (dadosSped.debitos && dadosSped.debitos.pis && Array.isArray(dadosSped.debitos.pis)) {
            dadosSped.debitos.pis.forEach(debito => {
                if (debito.valorTotalContribuicao && debito.valorTotalContribuicao > 0) {
                    detalhamento.consolidacao += debito.valorTotalContribuicao;
                    fonteUtilizada = 'sped_m200';
                }
            });
        }

        // PRIORIDADE 2: Ajustes M205 (valores extra-apuração, excluindo multas e juros)
        if (dadosSped.ajustes && dadosSped.ajustes.pis && Array.isArray(dadosSped.ajustes.pis)) {
            dadosSped.ajustes.pis.forEach(ajuste => {
                if (ajuste.tipo === 'ajuste_consolidacao' && ajuste.codigoAjuste) {
                    const valorAjuste = ajuste.valorAjuste || 0;
                    // Excluir multas e juros - códigos que começam com '4' ou '5' geralmente são multas/juros
                    const codigoAjuste = ajuste.codigoAjuste.toString();

                    if (!codigoAjuste.startsWith('4') && !codigoAjuste.startsWith('5')) {
                        // indicadorNatureza: 0=Redutor, 1=Acréscimo
                        if (ajuste.indicadorNatureza === '1') {
                            detalhamento.ajustes += valorAjuste;
                        } else if (ajuste.indicadorNatureza === '0') {
                            detalhamento.ajustes -= valorAjuste;
                        }
                        fonteUtilizada = 'sped_com_ajustes';
                    }
                }
            });
        }

        // PRIORIDADE 3: Detalhamento M210 (excluindo explicitamente multas e juros)
        if (dadosSped.detalhamento && dadosSped.detalhamento.pis && Array.isArray(dadosSped.detalhamento.pis)) {
            dadosSped.detalhamento.pis.forEach(det => {
                if (det.tipo === 'detalhamento_consolidacao') {
                    // Somar apenas o valor da contribuição, excluindo multas e juros
                    detalhamento.detalhamento += (det.valorContribuicao || 0);
                    // Não somar: det.valorMulta e det.valorJuros
                }
            });
        }

        // PRIORIDADE 4: Totalização 1100 (mais completa)
        if (dadosSped.totalizacao && dadosSped.totalizacao.pis && Array.isArray(dadosSped.totalizacao.pis)) {
            dadosSped.totalizacao.pis.forEach(tot => {
                const valorTotal = (tot.valorContribuicaoAPagar || 0) + 
                                  (tot.valorContribuicaoPaga || 0);
                if (valorTotal > detalhamento.consolidacao + detalhamento.ajustes) {
                    detalhamento.total = valorTotal;
                    fonteUtilizada = 'sped_1100_completo';
                }
            });
        }

        // Determinar valor final (priorizar o mais completo)
        valorDebitos = Math.max(
            detalhamento.consolidacao + detalhamento.ajustes + detalhamento.detalhamento,
            detalhamento.total
        );

        // Fallback: estimativa se não encontrou dados
        if (valorDebitos === 0) {
            const regime = determinarRegimeTributario(dadosSped);
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped) * 12;

            if (regime === 'simples') {
                valorDebitos = 0; // PIS incluído na alíquota única
            } else {
                const aliquotaPIS = regime === 'real' ? 0.0165 : 0.0065;
                valorDebitos = (faturamentoAnual * aliquotaPIS) / 12;
                fonteUtilizada = 'estimado_' + regime;
            }
        }

        // Log detalhado
        console.log('SPED-EXTRACTOR: Débitos PIS calculados:', {
            valorDebitos: valorDebitos,
            fonteUtilizada: fonteUtilizada,
            detalhamento: detalhamento,
            registrosEncontrados: {
                m200: dadosSped.debitos?.pis?.length || 0,
                m205: dadosSped.ajustes?.pis?.length || 0,
                m210: dadosSped.detalhamento?.pis?.length || 0,
                totalizacao: dadosSped.totalizacao?.pis?.length || 0
            }
        });

        return valorDebitos;
    }

    /**
     * Calcula débitos de COFINS considerando TODOS os ajustes extra-apuração
     * @param {Object} dadosSped - Dados extraídos do SPED
     * @returns {number} Valor total dos débitos de COFINS (incluindo ajustes)
     */
    function calcularDebitosCOFINS(dadosSped) {
        let valorDebitos = 0;
        let fonteUtilizada = 'estimado';
        let detalhamento = {
            consolidacao: 0,
            ajustes: 0,
            detalhamento: 0,
            total: 0
        };

        // PRIORIDADE 1: Registro M600 (Consolidação)
        if (dadosSped.debitos && dadosSped.debitos.cofins && Array.isArray(dadosSped.debitos.cofins)) {
            dadosSped.debitos.cofins.forEach(debito => {
                if (debito.valorTotalContribuicao && debito.valorTotalContribuicao > 0) {
                    detalhamento.consolidacao += debito.valorTotalContribuicao;
                    fonteUtilizada = 'sped_m600';
                }
            });
        }

        // PRIORIDADE 2: Ajustes M605 (valores extra-apuração, excluindo multas e juros)
        if (dadosSped.ajustes && dadosSped.ajustes.cofins && Array.isArray(dadosSped.ajustes.cofins)) {
            dadosSped.ajustes.cofins.forEach(ajuste => {
                if (ajuste.tipo === 'ajuste_consolidacao' && ajuste.codigoAjuste) {
                    const valorAjuste = ajuste.valorAjuste || 0;
                    // Excluir multas e juros - códigos que começam com '4' ou '5' geralmente são multas/juros
                    const codigoAjuste = ajuste.codigoAjuste.toString();

                    if (!codigoAjuste.startsWith('4') && !codigoAjuste.startsWith('5')) {
                        // indicadorNatureza: 0=Redutor, 1=Acréscimo
                        if (ajuste.indicadorNatureza === '1') {
                            detalhamento.ajustes += valorAjuste;
                        } else if (ajuste.indicadorNatureza === '0') {
                            detalhamento.ajustes -= valorAjuste;
                        }
                        fonteUtilizada = 'sped_com_ajustes';
                    }
                }
            });
        }

        // PRIORIDADE 3: Detalhamento M610 (excluindo explicitamente multas e juros)
        if (dadosSped.detalhamento && dadosSped.detalhamento.cofins && Array.isArray(dadosSped.detalhamento.cofins)) {
            dadosSped.detalhamento.cofins.forEach(det => {
                if (det.tipo === 'detalhamento_consolidacao') {
                    // Somar apenas o valor da contribuição, excluindo multas e juros
                    detalhamento.detalhamento += (det.valorContribuicao || 0);
                    // Não somar: det.valorMulta e det.valorJuros
                }
            });
        }

        // PRIORIDADE 4: Totalização 1500 (mais completa)
        if (dadosSped.totalizacao && dadosSped.totalizacao.cofins && Array.isArray(dadosSped.totalizacao.cofins)) {
            dadosSped.totalizacao.cofins.forEach(tot => {
                const valorTotal = (tot.valorContribuicaoAPagar || 0) + 
                                  (tot.valorContribuicaoPaga || 0);
                if (valorTotal > detalhamento.consolidacao + detalhamento.ajustes) {
                    detalhamento.total = valorTotal;
                    fonteUtilizada = 'sped_1500_completo';
                }
            });
        }

        // Determinar valor final (priorizar o mais completo)
        valorDebitos = Math.max(
            detalhamento.consolidacao + detalhamento.ajustes + detalhamento.detalhamento,
            detalhamento.total
        );

        // Fallback: estimativa se não encontrou dados
        if (valorDebitos === 0) {
            const regime = determinarRegimeTributario(dadosSped);
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped) * 12;

            if (regime === 'simples') {
                valorDebitos = 0; // COFINS incluído na alíquota única
            } else {  
                const aliquotaCOFINS = regime === 'real' ? 0.076 : 0.03;
                valorDebitos = (faturamentoAnual * aliquotaCOFINS) / 12;
                fonteUtilizada = 'estimado_' + regime;
            }
        }

        // Log detalhado
        console.log('SPED-EXTRACTOR: Débitos COFINS calculados:', {
            valorDebitos: valorDebitos,
            fonteUtilizada: fonteUtilizada,
            detalhamento: detalhamento,
            registrosEncontrados: {
                m600: dadosSped.debitos?.cofins?.length || 0,
                m605: dadosSped.ajustes?.cofins?.length || 0,
                m610: dadosSped.detalhamento?.cofins?.length || 0,
                totalizacao: dadosSped.totalizacao?.cofins?.length || 0
            }
        });

        return valorDebitos;
    }

    /**
     * Calcula débitos de ICMS considerando incentivos e ajustes (E111)
     * @param {Object} dadosSped - Dados extraídos do SPED
     * @returns {number} Valor total dos débitos de ICMS (incluindo ajustes)
     */
    function calcularDebitosICMS(dadosSped) {
        let valorDebitos = 0;
        let fonteUtilizada = 'estimado';
        let detalhamento = {
            apuracao: 0,
            ajustes: 0,
            incentivos: 0,
            total: 0
        };

        // PRIORIDADE 1: Registro E110 (Apuração básica) - CORRETO: valorTotalDebitos
        if (dadosSped.debitos && dadosSped.debitos.icms && Array.isArray(dadosSped.debitos.icms)) {
            dadosSped.debitos.icms.forEach(apuracao => {
                detalhamento.apuracao += apuracao.valorTotalDebitos || 0; // CORRETO: débitos, não créditos
                fonteUtilizada = 'sped_e110';
            });
        }

        // Fallback: verificar se os dados estão em impostos (compatibilidade)
        if (detalhamento.apuracao === 0 && dadosSped.impostos && dadosSped.impostos.icms && Array.isArray(dadosSped.impostos.icms)) {
            dadosSped.impostos.icms.forEach(apuracao => {
                detalhamento.apuracao += apuracao.valorTotalDebitos || 0; // CORRETO: débitos, não créditos
                fonteUtilizada = 'sped_e110_impostos';
            });
        }

        // PRIORIDADE 2: Ajustes E111 (incentivos e correções, excluindo multas e juros)
        if (dadosSped.ajustes && dadosSped.ajustes.icms && Array.isArray(dadosSped.ajustes.icms)) {
            dadosSped.ajustes.icms.forEach(ajuste => {
                const valorAjuste = ajuste.valorAjuste || 0;
                const codigoAjuste = ajuste.codigoAjuste || '';

                // Excluir códigos de multa e juros
                if (!codigoAjuste.startsWith('4') && !codigoAjuste.startsWith('5')) {
                    // Verificar se é incentivo fiscal (valores negativos reduzem débito)
                    if (codigoAjuste.includes('IC') || codigoAjuste.includes('incentiv')) {
                        detalhamento.incentivos += valorAjuste; // Incentivos geralmente reduzem
                    } else {
                        detalhamento.ajustes += valorAjuste; // Outros ajustes
                    }
                    fonteUtilizada = 'sped_com_ajustes_e111';
                }
            });
        }

        // Calcular total considerando todos os ajustes
        detalhamento.total = detalhamento.apuracao + detalhamento.ajustes + detalhamento.incentivos;
        valorDebitos = Math.max(0, detalhamento.total); // Não pode ser negativo

        // Fallback: estimativa se não encontrou dados
        if (valorDebitos === 0) {
            const tipoEmpresa = determinarTipoEmpresa(dadosSped);

            if (tipoEmpresa !== 'servicos') { // ICMS não se aplica a serviços
                const faturamentoAnual = calcularFaturamentoMensal(dadosSped) * 12;
                const aliquotaMedia = 0.18; // 18% como padrão
                const baseCalculoPerc = 0.6; // 60% do faturamento sujeito ao ICMS

                valorDebitos = (faturamentoAnual * baseCalculoPerc * aliquotaMedia) / 12;
                fonteUtilizada = 'estimado_' + tipoEmpresa;
            }
        }

        // Log detalhado
        console.log('SPED-EXTRACTOR: Débitos ICMS calculados:', {
            valorDebitos: valorDebitos,
            fonteUtilizada: fonteUtilizada,
            detalhamento: detalhamento,
            registrosEncontrados: {
                e110_debitos: dadosSped.debitos?.icms?.length || 0,
                e110_impostos: dadosSped.impostos?.icms?.length || 0,
                e111: dadosSped.ajustes?.icms?.length || 0
            }
        });

        return valorDebitos;
    }

    /**
     * Calcula débitos de IPI considerando ajustes (E210)
     * @param {Object} dadosSped - Dados extraídos do SPED
     * @returns {number} Valor total dos débitos de IPI (incluindo ajustes)
     */
    function calcularDebitosIPI(dadosSped) {
        let valorDebitos = 0;
        let fonteUtilizada = 'estimado';
        let detalhamento = {
            apuracao: 0,
            ajustes: 0,
            total: 0
        };

        // IPI só se aplica à indústria
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'industria') {
            return 0;
        }

        // PRIORIDADE 1: Registro E200 (Apuração IPI)
        if (dadosSped.impostos && dadosSped.impostos.ipi) {
            dadosSped.impostos.ipi.forEach(apuracao => {
                detalhamento.apuracao += apuracao.valorTotalDebitos || 0;
                fonteUtilizada = 'sped_e200';
            });
        }

        // PRIORIDADE 2: Ajustes E210
        if (dadosSped.ajustes && dadosSped.ajustes.ipi) {
            dadosSped.ajustes.ipi.forEach(ajuste => {
                detalhamento.ajustes += ajuste.valorAjuste || 0;
                fonteUtilizada = 'sped_com_ajustes_e210';
            });
        }

        detalhamento.total = detalhamento.apuracao + detalhamento.ajustes;
        valorDebitos = Math.max(0, detalhamento.total);

        // Fallback: estimativa se não encontrou dados
        if (valorDebitos === 0) {
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped) * 12;
            const aliquotaMedia = 0.10; // 10% como padrão
            const baseCalculoPerc = 0.4; // 40% do faturamento sujeito ao IPI

            valorDebitos = (faturamentoAnual * baseCalculoPerc * aliquotaMedia) / 12;
            fonteUtilizada = 'estimado_industria';
        }

        // Log detalhado
        console.log('SPED-EXTRACTOR: Débitos IPI calculados:', {
            valorDebitos: valorDebitos,
            fonteUtilizada: fonteUtilizada,
            detalhamento: detalhamento,
            registrosEncontrados: {
                e200: dadosSped.impostos?.ipi?.length || 0,
                e210: dadosSped.ajustes?.ipi?.length || 0
            }
        });

        return valorDebitos; // Valor mensal
    }

    /**
     * Calcula débitos de ISS com base nos dados disponíveis
     * @param {Object} dadosSped - Dados extraídos do SPED
     * @returns {number} Valor dos débitos de ISS
     */
    function calcularDebitosISS(dadosSped) {
        // ISS só se aplica a serviços
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'servicos') {
            return 0;
        }

        // ISS não consta no SPED, então estimamos
        const faturamento = calcularFaturamentoMensal(dadosSped) * 12;
        const aliquotaMedia = 0.05; // 5% como padrão

        return (faturamento * aliquotaMedia) / 12; // Retorna valor mensal
    }

    /**
     * Extrai dados do ciclo financeiro
     * @param {Object} dadosSped - Dados SPED
     * @returns {Object} Dados do ciclo financeiro formatados
     */
    function extrairCicloFinanceiro(dadosSped) {
        // Valores padrão
        let ciclo = {
            pmr: 30, // Prazo médio de recebimento
            pmp: 30, // Prazo médio de pagamento
            pme: 30, // Prazo médio de estoque
            percVista: 0.3, // Percentual de vendas à vista
            percPrazo: 0.7 // Percentual de vendas a prazo
        };

        // Se tiver dados da ECD, calcula os prazos com base nos saldos contábeis
        if (dadosSped.saldoClientes && dadosSped.receitaBruta && 
            dadosSped.receitaBruta > 0) {
            // PMR = (Clientes / Receita Bruta) × 360
            ciclo.pmr = Math.round((dadosSped.saldoClientes / (dadosSped.receitaBruta / 12)) * 30);
            ciclo.pmr = limitarValor(ciclo.pmr, 1, 180); // Limita a valores razoáveis
        }

        if (dadosSped.saldoFornecedores && dadosSped.receitaBruta && 
            dadosSped.receitaBruta > 0) {
            // Estima compras como percentual da receita
            const comprasEstimadas = dadosSped.receitaBruta * 0.6; // 60% da receita

            // PMP = (Fornecedores / Compras) × 360
            ciclo.pmp = Math.round((dadosSped.saldoFornecedores / (comprasEstimadas / 12)) * 30);
            ciclo.pmp = limitarValor(ciclo.pmp, 1, 180); // Limita a valores razoáveis
        }

        if (dadosSped.saldoEstoques && dadosSped.receitaBruta && 
            dadosSped.receitaBruta > 0) {
            // Estima CMV como percentual da receita
            const cmvEstimado = dadosSped.receitaBruta * 0.7; // 70% da receita

            // PME = (Estoques / CMV) × 360
            ciclo.pme = Math.round((dadosSped.saldoEstoques / (cmvEstimado / 12)) * 30);
            ciclo.pme = limitarValor(ciclo.pme, 1, 180); // Limita a valores razoáveis
        }

        // Calcula percentual de vendas à vista com base nos documentos
        if (dadosSped.documentos && dadosSped.documentos.length > 0) {
            const documentosSaida = dadosSped.documentos.filter(doc => 
                doc.indOper === '1' // Saída
            );

            if (documentosSaida.length > 0) {
                // Analisa formas de pagamento (estimativa)
                let countVista = 0;
                let valorTotalVendas = 0;
                let valorVendasVista = 0;

                documentosSaida.forEach(doc => {
                    const valorDoc = doc.valorTotal || 0;
                    valorTotalVendas += valorDoc;

                    // Verifica indícios de venda à vista
                    // 1. Modelos típicos de NFC-e (B2C): 65
                    if (doc.modelo === '65') {
                        countVista++;
                        valorVendasVista += valorDoc;
                    }

                    // 2. Condição de pagamento "à vista" no XML
                    if (doc.chaveNFe && doc.condicaoPagamento === '0') {
                        countVista++;
                        valorVendasVista += valorDoc;
                    }
                });

                if (valorTotalVendas > 0) {
                    // Calcula percentual com base no valor
                    ciclo.percVista = valorVendasVista / valorTotalVendas;

                    // Limita a valores razoáveis
                    ciclo.percVista = limitarValor(ciclo.percVista, 0.05, 0.95);
                    ciclo.percPrazo = 1 - ciclo.percVista;
                }
            }
        }

        return ciclo;
    }
    
    function extrairDadosIVA(dadosSped) {
        // Determina apenas o tipo básico da empresa (comercio, industria, servicos)
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);

        // Mapeamento para os setores genéricos do repositório
        const setorBasico = {
            'comercio': 'comercio',
            'industria': 'industria', 
            'servicos': 'servicos'
        }[tipoEmpresa] || 'comercio';

        // Verifica se o SetoresRepository está disponível
        if (typeof window.SetoresRepository !== 'undefined') {
            // Usa o tipo básico para obter configurações do repositório
            const dadosSetor = window.SetoresRepository.obterSetor(setorBasico);

            if (dadosSetor) {
                return {
                    cbs: dadosSetor['aliquota-cbs'] || 0.088,
                    ibs: dadosSetor['aliquota-ibs'] || 0.177,
                    categoriaIva: dadosSetor.categoriaIva || 'standard',
                    reducaoEspecial: dadosSetor.reducaoEspecial || 0,
                    // Adicionamos o código do setor para permitir seleção manual posterior
                    codigoSetor: setorBasico
                };
            }
        }

        // Valores padrão caso o repositório não esteja disponível
        return {
            cbs: 0.088,
            ibs: 0.177,
            categoriaIva: 'standard',
            reducaoEspecial: 0,
            codigoSetor: setorBasico
        };
    }
    
    /**
     * Limita um valor a um intervalo específico
     * @param {number} valor - Valor a ser limitado
     * @param {number} min - Valor mínimo
     * @param {number} max - Valor máximo
     * @returns {number} Valor limitado ao intervalo [min, max]
     */
    function limitarValor(valor, min, max) {
        return Math.max(min, Math.min(max, valor));
    }

    // Interface pública
    return {
        extrairDadosParaSimulador
    };
})();