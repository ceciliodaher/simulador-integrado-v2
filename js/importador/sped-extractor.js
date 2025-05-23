/**
 * @fileoverview Módulo de extração e processamento de dados SPED
 * Responsável por extrair informações tributárias, financeiras e operacionais
 * dos arquivos SPED para uso no simulador de Split Payment
 * 
 * @module sped-extractor
 * @author Expertzy Inteligência Tributária
 * @version 1.0.0
 */

window.SpedExtractor = (function() {
    
    /**
     * Configurações do extrator
     */
    const CONFIG = {
        // Cronograma oficial de transição tributária (LC 214/2025)
        cronogramaTransicao: {
            2026: { sistemaAtual: 0.90, ivaDual: 0.10 },
            2027: { sistemaAtual: 0.75, ivaDual: 0.25 },
            2028: { sistemaAtual: 0.60, ivaDual: 0.40 },
            2029: { sistemaAtual: 0.45, ivaDual: 0.55 },
            2030: { sistemaAtual: 0.30, ivaDual: 0.70 },
            2031: { sistemaAtual: 0.15, ivaDual: 0.85 },
            2032: { sistemaAtual: 0.05, ivaDual: 0.95 },
            2033: { sistemaAtual: 0.00, ivaDual: 1.00 }
        },
        
        // Alíquotas padrão do sistema IVA Dual
        aliquotasIVA: {
            cbs: 8.8,      // Contribuição sobre Bens e Serviços (%)
            ibs: 17.7,     // Imposto sobre Bens e Serviços (%)
            total: 26.5    // Total IVA Dual (%)
        },
        
        // Mapeamento de códigos de registro SPED
        registrosSped: {
            fiscal: {
                empresa: ['0000', '0001', '0005'],
                produtos: ['0200', '0205', '0210'],
                documentos: ['C100', 'C170', 'C400', 'C405'],
                impostos: ['E110', 'E111', 'E116', 'C197', 'C390'],
                creditos: ['C170', 'C175', 'D100', 'D190']
            },
            contribuicoes: {
                empresa: ['0000', '0001'],
                receitas: ['A100', 'A110', 'A120'],
                custos: ['A200', 'A210', 'A220'],
                creditos: ['C100', 'C110', 'C120', 'C170', 'C180'],
                debitos: ['M100', 'M110', 'M115', 'M200', 'M210']
            },
            ecf: {
                empresa: ['J001'],
                demonstracoes: ['J100', 'J150', 'J200', 'J210'],
                receitas: ['J100'],
                custos: ['J150'],
                resultado: ['J200', 'J210']
            },
            ecd: {
                empresa: ['I001', 'I010', 'I012'],
                balanco: ['J100', 'J150'],
                dre: ['J200', 'J210'],
                fluxoCaixa: ['J800', 'J801']
            }
        },
        
        // Tolerâncias para validações
        tolerancias: {
            percentualVariacao: 0.05,  // 5% de tolerância em variações
            valorMinimo: 0.01,         // Valor mínimo considerado
            margemErro: 0.001          // Margem de erro para cálculos
        }
    };

    /**
     * Processa dados consolidados de múltiplos SPEDs
     * @param {Object} speds - Dados parseados dos SPEDs
     * @param {Object} opcoes - Opções de processamento
     * @returns {Object} Dados consolidados e processados
     */
    function processarDadosConsolidados(speds, opcoes = {}) {
        console.log('SPED-EXTRACTOR: Iniciando processamento de dados consolidados');
        
        const opcoesDefault = {
            incluirComposicaoTributaria: true,
            incluirCreditosTributarios: true,
            incluirDadosFinanceiros: true,
            incluirCicloFinanceiro: true,
            calcularTransicao: true,
            parametrosIVA: CONFIG.aliquotasIVA,
            validarIntegridade: true,
            gerarLog: true
        };
        
        const opcoesFinais = { ...opcoesDefault, ...opcoes };
        const log = [];
        
        try {
            // 1. Extrair informações básicas da empresa
            log.push('📋 Extraindo informações básicas da empresa...');
            const empresaInfo = extrairInformacoesEmpresa(speds, log);
            
            // 2. Processar composição tributária atual
            log.push('💰 Processando composição tributária atual...');
            const composicaoTributaria = processarComposicaoTributaria(speds, opcoesFinais, log);
            
            // 3. Extrair e calcular dados financeiros
            log.push('📊 Extraindo dados financeiros das demonstrações...');
            const dadosFinanceiros = extrairDadosFinanceiros(speds, opcoesFinais, log);
            
            // 4. Calcular ciclo financeiro
            log.push('⏱️ Calculando ciclo financeiro...');
            const cicloFinanceiro = calcularCicloFinanceiro(speds, dadosFinanceiros, opcoesFinais, log);
            
            // 5. Processar transição tributária (se solicitado)
            let transicaoTributaria = null;
            if (opcoesFinais.calcularTransicao) {
                log.push('📈 Processando cenário de transição tributária...');
                transicaoTributaria = processarTransicaoTributaria(
                    composicaoTributaria, 
                    opcoesFinais.parametrosIVA, 
                    log
                );
            }
            
            // 6. Validar integridade dos dados processados
            if (opcoesFinais.validarIntegridade) {
                log.push('✅ Validando integridade dos dados processados...');
                validarIntegridadeDados(empresaInfo, composicaoTributaria, dadosFinanceiros, log);
            }
            
            // 7. Consolidar resultados
            const resultadoConsolidado = {
                empresaInfo,
                composicaoTributaria,
                dadosFinanceiros,
                cicloFinanceiro,
                transicaoTributaria,
                metadados: {
                    timestampProcessamento: new Date().toISOString(),
                    tiposSpedProcessados: Object.keys(speds),
                    opcoes: opcoesFinais,
                    versaoExtrator: '1.0.0'
                },
                log: opcoesFinais.gerarLog ? log : [],
                observacoes: gerarObservacoes(empresaInfo, composicaoTributaria, dadosFinanceiros, log),
                qualidadeDados: avaliarQualidadeDados(speds, composicaoTributaria, dadosFinanceiros)
            };
            
            log.push('🎉 Processamento consolidado concluído com sucesso');
            console.log('SPED-EXTRACTOR: Processamento consolidado concluído', {
                empresa: empresaInfo.razaoSocial,
                impostos: composicaoTributaria.aliquotasEfetivas.total,
                margem: dadosFinanceiros.resultado.margemOperacional
            });
            
            return resultadoConsolidado;
            
        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro no processamento consolidado:', erro);
            log.push(`❌ ERRO CRÍTICO: ${erro.message}`);
            
            throw new Error(`Falha no processamento consolidado: ${erro.message}`);
        }
    }

    /**
     * Extrai informações básicas da empresa dos SPEDs
     * @param {Object} speds - Dados dos SPEDs
     * @param {Array} log - Array de log
     * @returns {Object} Informações da empresa
     */
    function extrairInformacoesEmpresa(speds, log) {
        const empresaInfo = {
            razaoSocial: '',
            nomeFantasia: '',
            cnpj: '',
            inscricaoEstadual: '',
            uf: '',
            municipio: '',
            atividade: '',
            regimeTributario: '',
            dataInicialPeriodo: '',
            dataFinalPeriodo: '',
            fonte: ''
        };

        // Priorizar dados do SPED Fiscal
        if (speds['sped-fiscal'] || speds.fiscal) {
            const fiscal = speds['sped-fiscal'] || speds.fiscal;
            
            if (fiscal.dadosEmpresa) {
                empresaInfo.razaoSocial = fiscal.dadosEmpresa.razaoSocial || '';
                empresaInfo.nomeFantasia = fiscal.dadosEmpresa.nomeFantasia || '';
                empresaInfo.cnpj = fiscal.dadosEmpresa.cnpj || '';
                empresaInfo.inscricaoEstadual = fiscal.dadosEmpresa.inscricaoEstadual || '';
                empresaInfo.uf = fiscal.dadosEmpresa.uf || '';
                empresaInfo.municipio = fiscal.dadosEmpresa.municipio || '';
                empresaInfo.dataInicialPeriodo = fiscal.dadosEmpresa.dataInicialPeriodo || '';
                empresaInfo.dataFinalPeriodo = fiscal.dadosEmpresa.dataFinalPeriodo || '';
                empresaInfo.fonte = 'SPED Fiscal';
                
                log.push(`   🏢 Empresa: ${empresaInfo.razaoSocial}`);
                log.push(`   📋 CNPJ: ${empresaInfo.cnpj}`);
                log.push(`   📅 Período: ${empresaInfo.dataInicialPeriodo} a ${empresaInfo.dataFinalPeriodo}`);
            }
        }
        
        // Complementar com dados do SPED Contribuições se disponível
        if (speds['sped-contribuicoes'] || speds.contribuicoes) {
            const contrib = speds['sped-contribuicoes'] || speds.contribuicoes;
            
            if (contrib.dadosEmpresa && !empresaInfo.razaoSocial) {
                empresaInfo.razaoSocial = contrib.dadosEmpresa.razaoSocial || '';
                empresaInfo.cnpj = contrib.dadosEmpresa.cnpj || '';
                empresaInfo.fonte = empresaInfo.fonte ? `${empresaInfo.fonte}, SPED Contribuições` : 'SPED Contribuições';
            }
        }
        
        // Complementar com dados do ECF se disponível
        if (speds['sped-ecf'] || speds.ecf) {
            const ecf = speds['sped-ecf'] || speds.ecf;
            
            if (ecf.dadosEmpresa) {
                if (!empresaInfo.regimeTributario && ecf.dadosEmpresa.regimeTributario) {
                    empresaInfo.regimeTributario = ecf.dadosEmpresa.regimeTributario;
                }
                empresaInfo.fonte = empresaInfo.fonte ? `${empresaInfo.fonte}, ECF` : 'ECF';
            }
        }

        if (!empresaInfo.razaoSocial) {
            log.push('⚠️ AVISO: Informações básicas da empresa não encontradas nos SPEDs');
        }

        return empresaInfo;
    }

    /**
     * Processa a composição tributária atual da empresa
     * @param {Object} speds - Dados dos SPEDs
     * @param {Object} opcoes - Opções de processamento
     * @param {Array} log - Array de log
     * @returns {Object} Composição tributária detalhada
     */
    function processarComposicaoTributaria(speds, opcoes, log) {
        const composicao = {
            faturamentoTotal: 0,
            debitos: {
                pis: 0,
                cofins: 0,
                icms: 0,
                ipi: 0,
                iss: 0,
                outros: 0
            },
            creditos: {
                pis: 0,
                cofins: 0,
                icms: 0,
                ipi: 0,
                iss: 0,
                outros: 0
            },
            impostosLiquidos: {
                pis: 0,
                cofins: 0,
                icms: 0,
                ipi: 0,
                iss: 0,
                total: 0
            },
            aliquotasEfetivas: {
                pis: 0,
                cofins: 0,
                icms: 0,
                ipi: 0,
                iss: 0,
                total: 0
            },
            fonte: [],
            observacoes: []
        };

        try {
            // 1. Processar SPED Fiscal (ICMS/IPI)
            if (speds['sped-fiscal'] || speds.fiscal) {
                log.push('   📊 Processando impostos do SPED Fiscal...');
                processarImpostosFiscal(speds['sped-fiscal'] || speds.fiscal, composicao, log);
            }

            // 2. Processar SPED Contribuições (PIS/COFINS)
            if (speds['sped-contribuicoes'] || speds.contribuicoes) {
                log.push('   💼 Processando impostos do SPED Contribuições...');
                processarImpostosContribuicoes(speds['sped-contribuicoes'] || speds.contribuicoes, composicao, log);
            }

            // 3. Processar ECF (dados complementares)
            if (speds['sped-ecf'] || speds.ecf) {
                log.push('   📋 Processando dados complementares do ECF...');
                processarDadosECF(speds['sped-ecf'] || speds.ecf, composicao, log);
            }

            // 4. Calcular valores líquidos e alíquotas efetivas
            calcularImpostosLiquidos(composicao, log);
            calcularAliquotasEfetivas(composicao, log);

            // 5. Validar consistência dos dados
            validarComposicaoTributaria(composicao, log);

            log.push(`   ✅ Composição tributária processada - Alíquota total: ${composicao.aliquotasEfetivas.total.toFixed(2)}%`);

        } catch (erro) {
            log.push(`   ❌ Erro ao processar composição tributária: ${erro.message}`);
            console.error('SPED-EXTRACTOR: Erro na composição tributária:', erro);
            throw erro;
        }

        return composicao;
    }

    /**
     * Processa impostos do SPED Fiscal
     * @param {Object} spedFiscal - Dados do SPED Fiscal
     * @param {Object} composicao - Objeto de composição a ser preenchido
     * @param {Array} log - Array de log
     */
    function processarImpostosFiscal(spedFiscal, composicao, log) {
        if (!spedFiscal.registros) {
            log.push('     ⚠️ Registros do SPED Fiscal não encontrados');
            return;
        }

        let faturamentoICMS = 0;
        let debitosICMS = 0;
        let creditosICMS = 0;
        let debitosIPI = 0;
        let creditosIPI = 0;

        try {
            // Processar documentos fiscais (C100, C400)
            if (spedFiscal.registros.C100) {
                spedFiscal.registros.C100.forEach(registro => {
                    const valorDocumento = parseFloat(registro.VL_DOC) || 0;
                    const valorICMS = parseFloat(registro.VL_ICMS) || 0;
                    
                    faturamentoICMS += valorDocumento;
                    debitosICMS += valorICMS;
                });
            }

            // Processar apuração ICMS (E110, E111)
            if (spedFiscal.registros.E110) {
                spedFiscal.registros.E110.forEach(registro => {
                    const valorDebito = parseFloat(registro.VL_TOT_DEBITOS) || 0;
                    const valorCredito = parseFloat(registro.VL_TOT_CREDITOS) || 0;
                    
                    debitosICMS += valorDebito;
                    creditosICMS += valorCredito;
                });
            }

            // Processar IPI se houver
            if (spedFiscal.registros.C400) {
                spedFiscal.registros.C400.forEach(registro => {
                    const valorIPI = parseFloat(registro.VL_IPI) || 0;
                    debitosIPI += valorIPI;
                });
            }

            // Atualizar composição
            composicao.faturamentoTotal = Math.max(composicao.faturamentoTotal, faturamentoICMS);
            composicao.debitos.icms = debitosICMS;
            composicao.creditos.icms = creditosICMS;
            composicao.debitos.ipi = debitosIPI;
            composicao.fonte.push('SPED Fiscal');

            log.push(`     💰 ICMS: Débitos R$ ${debitosICMS.toFixed(2)}, Créditos R$ ${creditosICMS.toFixed(2)}`);
            if (debitosIPI > 0) {
                log.push(`     🏭 IPI: Débitos R$ ${debitosIPI.toFixed(2)}`);
            }

        } catch (erro) {
            log.push(`     ❌ Erro ao processar SPED Fiscal: ${erro.message}`);
            console.error('SPED-EXTRACTOR: Erro no SPED Fiscal:', erro);
        }
    }

    /**
     * Processa impostos do SPED Contribuições
     * @param {Object} spedContrib - Dados do SPED Contribuições
     * @param {Object} composicao - Objeto de composição a ser preenchido
     * @param {Array} log - Array de log
     */
    function processarImpostosContribuicoes(spedContrib, composicao, log) {
        if (!spedContrib.registros) {
            log.push('     ⚠️ Registros do SPED Contribuições não encontrados');
            return;
        }

        let faturamentoPisCofins = 0;
        let debitosPIS = 0;
        let creditosPIS = 0;
        let debitosCOFINS = 0;
        let creditosCOFINS = 0;

        try {
            // Faturamento from A100 (remains the same)
            if (spedContrib.registros.A100) {
                spedContrib.registros.A100.forEach(registro => {
                    const valorReceita = parseFloat(registro.VL_REC_BRT) || 0; // Assuming VL_REC_BRT is the correct field based on parser
                    faturamentoPisCofins += valorReceita;
                });
            }
            log.push(`     Receita Bruta (SPED Contrib A100): R$ ${faturamentoPisCofins.toFixed(2)}`);


            // PIS Debits from M200
            if (spedContrib.registros.M200) {
                spedContrib.registros.M200.forEach(registro => {
                    debitosPIS += (parseFloat(registro.VL_TOT_CONT_NC_PER) || 0);
                    debitosPIS += (parseFloat(registro.VL_TOT_CONT_CUM_PER) || 0);
                });
                log.push(`     PIS Debits (M200): R$ ${debitosPIS.toFixed(2)}`);
            }

            // COFINS Debits from M600
            if (spedContrib.registros.M600) {
                spedContrib.registros.M600.forEach(registro => {
                    debitosCOFINS += (parseFloat(registro.VL_TOT_CONT_NC_PER) || 0);
                    debitosCOFINS += (parseFloat(registro.VL_TOT_CONT_CUM_PER) || 0);
                });
                log.push(`     COFINS Debits (M600): R$ ${debitosCOFINS.toFixed(2)}`);
            }

            // PIS Credits from M100
            if (spedContrib.registros.M100) {
                spedContrib.registros.M100.forEach(registro => {
                    creditosPIS += parseFloat(registro.VL_CRED) || 0;
                });
                log.push(`     PIS Credits (M100): R$ ${creditosPIS.toFixed(2)}`);
            }
            
            // (Optional but good for completeness) PIS Credits from C170 if M100 is not exhaustive
            // This part can be added if M100 doesn't capture all document-level credits.
            // For now, M100 is the primary source for consolidated credits.

            // COFINS Credits from M500
            if (spedContrib.registros.M500) { // Assuming M500 is for COFINS credits, similar to M100 for PIS
                spedContrib.registros.M500.forEach(registro => {
                    creditosCOFINS += parseFloat(registro.VL_CRED) || 0;
                });
                log.push(`     COFINS Credits (M500): R$ ${creditosCOFINS.toFixed(2)}`);
            }
            // (Optional but good for completeness) COFINS Credits from C170

            // Update composicao object
            composicao.faturamentoTotal = Math.max(composicao.faturamentoTotal, faturamentoPisCofins);
            composicao.debitos.pis += debitosPIS; // Use += in case other SPEDs contribute
            composicao.creditos.pis += creditosPIS;
            composicao.debitos.cofins += debitosCOFINS;
            composicao.creditos.cofins += creditosCOFINS;
            
            if (!composicao.fonte.includes('SPED Contribuições')) {
                composicao.fonte.push('SPED Contribuições');
            }

        } catch (erro) {
            log.push(`     ❌ Erro ao processar SPED Contribuições: ${erro.message}`);
            console.error('SPED-EXTRACTOR: Erro no SPED Contribuições:', erro);
        }
    }

    /**
     * Processa dados complementares do ECF
     * @param {Object} ecf - Dados do ECF
     * @param {Object} composicao - Objeto de composição a ser preenchido
     * @param {Array} log - Array de log
     */
    function processarDadosECF(ecf, composicao, log) {
        if (!ecf.registros) {
            log.push('     ⚠️ Registros do ECF não encontrados');
            return;
        }

        try {
            // Processar dados de receita bruta se não foi obtida de outros SPEDs
            if (ecf.registros.J100 && composicao.faturamentoTotal === 0) {
                ecf.registros.J100.forEach(registro => {
                    const receitaBruta = parseFloat(registro.VL_REC_BRT) || 0;
                    composicao.faturamentoTotal = Math.max(composicao.faturamentoTotal, receitaBruta);
                });
            }

            // Processar dados tributários complementares
            if (ecf.registros.J200) {
                ecf.registros.J200.forEach(registro => {
                    // Dados complementares de tributos se necessário
                    const impostoRenda = parseFloat(registro.VL_IRPJ) || 0;
                    const contribuicaoSocial = parseFloat(registro.VL_CSLL) || 0;
                    
                    composicao.debitos.outros += impostoRenda + contribuicaoSocial;
                });
            }

            composicao.fonte.push('ECF');
            log.push('     📋 Dados complementares do ECF processados');

        } catch (erro) {
            log.push(`     ❌ Erro ao processar ECF: ${erro.message}`);
            console.error('SPED-EXTRACTOR: Erro no ECF:', erro);
        }
    }

    /**
     * Calcula impostos líquidos (débitos - créditos)
     * @param {Object} composicao - Composição tributária
     * @param {Array} log - Array de log
     */
    function calcularImpostosLiquidos(composicao, log) {
        try {
            composicao.impostosLiquidos.pis = Math.max(0, composicao.debitos.pis - composicao.creditos.pis);
            composicao.impostosLiquidos.cofins = Math.max(0, composicao.debitos.cofins - composicao.creditos.cofins);
            composicao.impostosLiquidos.icms = Math.max(0, composicao.debitos.icms - composicao.creditos.icms);
            composicao.impostosLiquidos.ipi = Math.max(0, composicao.debitos.ipi - composicao.creditos.ipi);
            composicao.impostosLiquidos.iss = Math.max(0, composicao.debitos.iss - composicao.creditos.iss);

            composicao.impostosLiquidos.total = 
                composicao.impostosLiquidos.pis +
                composicao.impostosLiquidos.cofins +
                composicao.impostosLiquidos.icms +
                composicao.impostosLiquidos.ipi +
                composicao.impostosLiquidos.iss +
                composicao.debitos.outros;

            log.push(`   💰 Impostos líquidos totais: R$ ${composicao.impostosLiquidos.total.toFixed(2)}`);

        } catch (erro) {
            log.push(`   ❌ Erro ao calcular impostos líquidos: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Calcula alíquotas efetivas sobre o faturamento
     * @param {Object} composicao - Composição tributária
     * @param {Array} log - Array de log
     */
    function calcularAliquotasEfetivas(composicao, log) {
        if (composicao.faturamentoTotal <= 0) {
            log.push('   ⚠️ Faturamento zero ou negativo - não é possível calcular alíquotas efetivas');
            return;
        }

        try {
            composicao.aliquotasEfetivas.pis = (composicao.impostosLiquidos.pis / composicao.faturamentoTotal) * 100;
            composicao.aliquotasEfetivas.cofins = (composicao.impostosLiquidos.cofins / composicao.faturamentoTotal) * 100;
            composicao.aliquotasEfetivas.icms = (composicao.impostosLiquidos.icms / composicao.faturamentoTotal) * 100;
            composicao.aliquotasEfetivas.ipi = (composicao.impostosLiquidos.ipi / composicao.faturamentoTotal) * 100;
            composicao.aliquotasEfetivas.iss = (composicao.impostosLiquidos.iss / composicao.faturamentoTotal) * 100;

            composicao.aliquotasEfetivas.total = (composicao.impostosLiquidos.total / composicao.faturamentoTotal) * 100;

            log.push(`   📊 Alíquotas efetivas calculadas:`);
            log.push(`      PIS: ${composicao.aliquotasEfetivas.pis.toFixed(3)}%`);
            log.push(`      COFINS: ${composicao.aliquotasEfetivas.cofins.toFixed(3)}%`);
            log.push(`      ICMS: ${composicao.aliquotasEfetivas.icms.toFixed(3)}%`);
            log.push(`      IPI: ${composicao.aliquotasEfetivas.ipi.toFixed(3)}%`);
            log.push(`      TOTAL: ${composicao.aliquotasEfetivas.total.toFixed(3)}%`);

        } catch (erro) {
            log.push(`   ❌ Erro ao calcular alíquotas efetivas: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Extrai dados financeiros das demonstrações contábeis
     * @param {Object} speds - Dados dos SPEDs
     * @param {Object} opcoes - Opções de processamento
     * @param {Array} log - Array de log
     * @returns {Object} Dados financeiros extraídos
     */
    // Substituir a função extrairDadosFinanceiros no sped-extractor.js
    function extrairDadosFinanceiros(speds, opcoes, log) {
        const dadosFinanceiros = {
            receitas: {
                receitaBruta: 0,
                receitaLiquida: 0,
                receitaOperacional: 0,
                outrasReceitas: 0
            },
            custos: {
                custoProdutos: 0,
                custoServicos: 0,
                custoTotal: 0
            },
            despesas: {
                despesasComerciais: 0,
                despesasAdministrativas: 0,
                despesasOperacionais: 0,
                despesasFinanceiras: 0,
                outrasDespesas: 0
            },
            resultado: {
                lucroBruto: 0,
                lucroOperacional: 0,
                lucroLiquido: 0,
                margemBruta: 0,
                margemOperacional: 0,
                margemLiquida: 0
            },
            fonte: [],
            observacoes: []
        };

        try {
            // 1. Processar ECF (dados primários das demonstrações)
            if (speds['ecf'] || speds['sped-ecf']) {
                log.push('   📊 Extraindo dados financeiros do ECF...');
                processarDemonstracoesFiscaisCorrigido(speds['ecf'] || speds['sped-ecf'], dadosFinanceiros, log);
            }

            // 2. Processar ECD (dados contábeis detalhados)  
            if (speds['ecd'] || speds['sped-ecd']) {
                log.push('   📋 Extraindo dados contábeis do ECD...');
                processarDemonstracoesContabeisCorrigido(speds['ecd'] || speds['sped-ecd'], dadosFinanceiros, log);
            }

            // 3. Complementar com dados do SPED Contribuições
            if (speds['contribuicoes'] || speds['sped-contribuicoes']) {
                log.push('   💼 Complementando com dados do SPED Contribuições...');
                complementarComContribuicoesCorrigido(speds['contribuicoes'] || speds['sped-contribuicoes'], dadosFinanceiros, log);
            }

            // 4. Se não houver dados específicos, estimar baseado na composição tributária
            if (dadosFinanceiros.receitas.receitaBruta === 0) {
                log.push('   📊 Estimando dados financeiros baseado no faturamento tributário...');
                estimarDadosFinanceirosPorFaturamento(speds, dadosFinanceiros, log);
            }

            // 5. Calcular indicadores derivados
            calcularResultadosFinanceirosCorrigido(dadosFinanceiros, log);
            calcularMargensOperacionaisCorrigido(dadosFinanceiros, log);

            // 6. Validar consistência dos dados financeiros
            validarDadosFinanceirosCorrigido(dadosFinanceiros, log);

            log.push(`   ✅ Dados financeiros processados - Margem operacional: ${dadosFinanceiros.resultado.margemOperacional.toFixed(2)}%`);

        } catch (erro) {
            log.push(`   ❌ Erro ao extrair dados financeiros: ${erro.message}`);
            console.error('SPED-EXTRACTOR: Erro nos dados financeiros:', erro);
            dadosFinanceiros.observacoes.push(`Erro na extração: ${erro.message}`);
        }

        return dadosFinanceiros;
    }

    /**
     * Versão corrigida do processamento de demonstrações fiscais
     */
    function processarDemonstracoesFiscaisCorrigido(ecf, dadosFinanceiros, log) {
        if (!ecf.registros && !ecf.dadosEmpresa) {
            log.push('     ⚠️ Estrutura do ECF não reconhecida');
            return;
        }

        try {
            // Processar diferentes estruturas possíveis do ECF
            let registrosECF = ecf.registros || ecf;

            // Buscar por registros J100 (Receitas)
            if (registrosECF.J100 || registrosECF['J100']) {
                const registrosJ100 = registrosECF.J100 || registrosECF['J100'];
                if (Array.isArray(registrosJ100)) {
                    registrosJ100.forEach(registro => {
                        const receitaBruta = parseFloat(registro.VL_REC_BRT || registro.receitaBruta || 0);
                        const receitaLiquida = parseFloat(registro.VL_REC_LIQ || registro.receitaLiquida || 0);

                        dadosFinanceiros.receitas.receitaBruta += receitaBruta;
                        dadosFinanceiros.receitas.receitaLiquida += receitaLiquida || receitaBruta;
                    });
                }
            }

            // Buscar por registros J150 (Custos)
            if (registrosECF.J150 || registrosECF['J150']) {
                const registrosJ150 = registrosECF.J150 || registrosECF['J150'];
                if (Array.isArray(registrosJ150)) {
                    registrosJ150.forEach(registro => {
                        const custoTotal = parseFloat(registro.VL_CUSTO || registro.custoTotal || 0);
                        dadosFinanceiros.custos.custoTotal += custoTotal;
                    });
                }
            }

            // Buscar por registros J200 (Resultado)
            if (registrosECF.J200 || registrosECF['J200']) {
                const registrosJ200 = registrosECF.J200 || registrosECF['J200'];
                if (Array.isArray(registrosJ200)) {
                    registrosJ200.forEach(registro => {
                        const lucroOperacional = parseFloat(registro.VL_LUCRO_OPER || registro.lucroOperacional || 0);
                        const lucroLiquido = parseFloat(registro.VL_LUCRO_LIQ || registro.lucroLiquido || 0);

                        dadosFinanceiros.resultado.lucroOperacional += lucroOperacional;
                        dadosFinanceiros.resultado.lucroLiquido += lucroLiquido || lucroOperacional;
                    });
                }
            }

            dadosFinanceiros.fonte.push('ECF');
            log.push(`     📊 ECF processado - Receita bruta: R$ ${dadosFinanceiros.receitas.receitaBruta.toFixed(2)}`);

        } catch (erro) {
            log.push(`     ❌ Erro ao processar ECF: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Estima dados financeiros baseado no faturamento tributário quando não disponíveis
     */
    function estimarDadosFinanceirosPorFaturamento(speds, dadosFinanceiros, log) {
        let faturamentoBase = 0;

        // Buscar faturamento de qualquer SPED disponível
        Object.values(speds).forEach(sped => {
            if (sped.dadosEmpresa && sped.dadosEmpresa.faturamento) {
                faturamentoBase = Math.max(faturamentoBase, sped.dadosEmpresa.faturamento);
            }
        });

        if (faturamentoBase > 0) {
            // Estimativas conservadoras baseadas em médias setoriais
            dadosFinanceiros.receitas.receitaBruta = faturamentoBase;
            dadosFinanceiros.receitas.receitaLiquida = faturamentoBase * 0.95; // 5% de deduções
            dadosFinanceiros.custos.custoTotal = faturamentoBase * 0.60; // 60% CMV típico
            dadosFinanceiros.despesas.despesasOperacionais = faturamentoBase * 0.20; // 20% despesas

            log.push(`     ⚠️ Dados financeiros DETALHADOS estimados (ECF/ECD info ausente/incompleta).`);
            log.push(`        Estimativa baseada em Faturamento Total: R$ ${faturamentoBase.toFixed(2)}`);
            log.push(`        Receita Líquida Estimada: R$ ${dadosFinanceiros.receitas.receitaLiquida.toFixed(2)}`);
            log.push(`        Custo Total Estimado: R$ ${dadosFinanceiros.custos.custoTotal.toFixed(2)}`);
            log.push(`        Despesas Operacionais Estimadas: R$ ${dadosFinanceiros.despesas.despesasOperacionais.toFixed(2)}`);
            dadosFinanceiros.observacoes.push('Dados financeiros detalhados (Receita Líquida, Custos, Despesas) foram estimados baseados no faturamento tributário total, pois informações específicas de ECF/ECD não estavam disponíveis ou completas.');
        } else {
            log.push('     ⚠️ Estimativa de dados financeiros não pôde ser realizada: Faturamento base é zero.');
            dadosFinanceiros.observacoes.push('Estimativa de dados financeiros detalhados falhou pois o faturamento base não pôde ser determinado dos arquivos SPED.');
        }
    }

    /**
     * Versão corrigida do cálculo de resultados financeiros
     */
    function calcularResultadosFinanceirosCorrigido(dadosFinanceiros, log) {
        try {
            // Calcular lucro bruto
            dadosFinanceiros.resultado.lucroBruto = 
                dadosFinanceiros.receitas.receitaLiquida - dadosFinanceiros.custos.custoTotal;

            // Se não temos lucro operacional calculado, estimar
            if (dadosFinanceiros.resultado.lucroOperacional === 0) {
                dadosFinanceiros.resultado.lucroOperacional = 
                    dadosFinanceiros.resultado.lucroBruto - dadosFinanceiros.despesas.despesasOperacionais;
            }

            // Se não temos lucro líquido, usar operacional como base
            if (dadosFinanceiros.resultado.lucroLiquido === 0) {
                dadosFinanceiros.resultado.lucroLiquido = dadosFinanceiros.resultado.lucroOperacional * 0.85; // Desconto IR/CSLL
            }

            log.push(`     💰 Resultados calculados:`);
            log.push(`        Lucro Bruto: R$ ${dadosFinanceiros.resultado.lucroBruto.toFixed(2)}`);
            log.push(`        Lucro Operacional: R$ ${dadosFinanceiros.resultado.lucroOperacional.toFixed(2)}`);
            log.push(`        Lucro Líquido: R$ ${dadosFinanceiros.resultado.lucroLiquido.toFixed(2)}`);

        } catch (erro) {
            log.push(`     ❌ Erro ao calcular resultados: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Versão corrigida do cálculo de margens operacionais
     */
    function calcularMargensOperacionaisCorrigido(dadosFinanceiros, log) {
        const receitaBase = dadosFinanceiros.receitas.receitaLiquida || dadosFinanceiros.receitas.receitaBruta;

        if (receitaBase <= 0) {
            log.push('     ⚠️ Receita zero ou negativa - não é possível calcular margens');
            return;
        }

        try {
            dadosFinanceiros.resultado.margemBruta = 
                (dadosFinanceiros.resultado.lucroBruto / receitaBase) * 100;

            dadosFinanceiros.resultado.margemOperacional = 
                (dadosFinanceiros.resultado.lucroOperacional / receitaBase) * 100;

            dadosFinanceiros.resultado.margemLiquida = 
                (dadosFinanceiros.resultado.lucroLiquido / receitaBase) * 100;

            log.push(`     📊 Margens calculadas:`);
            log.push(`        Margem Bruta: ${dadosFinanceiros.resultado.margemBruta.toFixed(2)}%`);
            log.push(`        Margem Operacional: ${dadosFinanceiros.resultado.margemOperacional.toFixed(2)}%`);
            log.push(`        Margem Líquida: ${dadosFinanceiros.resultado.margemLiquida.toFixed(2)}%`);

        } catch (erro) {
            log.push(`     ❌ Erro ao calcular margens: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Versão aprimorada do cálculo do ciclo financeiro
     */
    function calcularCicloFinanceiroCorrigido(speds, dadosFinanceiros, opcoes, log) {
        const cicloFinanceiro = {
            pmr: 30,  // Prazo Médio de Recebimento (dias)
            pme: 30,  // Prazo Médio de Estoque (dias)  
            pmp: 30,  // Prazo Médio de Pagamento (dias)
            cicloOperacional: 60,     // PMR + PME
            cicloFinanceiroLiquido: 30,  // Ciclo Operacional - PMP
            giroAtivos: 0,
            giroEstoque: 0,
            fonte: [],
            observacoes: [],
            estimado: true
        };

        try {
            // Tentar calcular baseado nos dados financeiros reais
            if (dadosFinanceiros.receitas.receitaLiquida > 0) {
                log.push('   📊 Calculando ciclo baseado nos dados financeiros reais...');

                const receitaAnual = dadosFinanceiros.receitas.receitaLiquida * 12;
                const custoAnual = dadosFinanceiros.custos.custoTotal * 12;

                // Estimar PMR baseado no faturamento (empresas B2B geralmente 30-45 dias)
                if (receitaAnual > 0) {
                    // Heurística: empresas maiores tendem a ter PMR menor
                    if (receitaAnual > 100000000) { // > 100M
                        cicloFinanceiro.pmr = 25;
                    } else if (receitaAnual > 50000000) { // > 50M
                        cicloFinanceiro.pmr = 30;
                    } else {
                        cicloFinanceiro.pmr = 35;
                    }
                }

                // Estimar PME baseado no giro de estoque
                if (custoAnual > 0 && receitaAnual > 0) {
                    cicloFinanceiro.giroEstoque = receitaAnual / custoAnual;
                    // PME = 365 / (Giro do estoque anual)
                    const giroEstoqueAnual = Math.max(cicloFinanceiro.giroEstoque * 6, 4); // Mínimo 4 giros/ano
                    cicloFinanceiro.pme = Math.round(365 / giroEstoqueAnual);
                    cicloFinanceiro.pme = Math.min(Math.max(cicloFinanceiro.pme, 15), 90); // Entre 15 e 90 dias
                }

                // Estimar PMP (geralmente 30-60 dias dependendo do porte)
                if (receitaAnual > 50000000) {
                    cicloFinanceiro.pmp = 45; // Empresas maiores conseguem prazos maiores
                } else {
                    cicloFinanceiro.pmp = 30;
                }

                cicloFinanceiro.estimado = false;
                cicloFinanceiro.fonte.push('Cálculo baseado em dados financeiros reais');

                log.push(`     📊 Ciclo calculado com dados reais:`);
                log.push(`        Receita anual estimada: R$ ${receitaAnual.toFixed(2)}`);
            }

            // Analisar fluxo de caixa do ECD se disponível
            if (speds['ecd'] || speds['sped-ecd']) {
                log.push('   ⏱️ Analisando fluxo de caixa do ECD...');
                analisarFluxoCaixaECDCorrigido(speds['ecd'] || speds['sped-ecd'], cicloFinanceiro, log);
            }

            // Calcular indicadores derivados
            calcularIndicadoresCicloCorrigido(cicloFinanceiro, log);

            // Validar razoabilidade dos valores
            validarCicloFinanceiroCorrigido(cicloFinanceiro, log);

            log.push(`   ✅ Ciclo financeiro calculado: ${cicloFinanceiro.cicloFinanceiroLiquido} dias`);

        } catch (erro) {
            log.push(`   ❌ Erro ao calcular ciclo financeiro: ${erro.message}`);
            console.error('SPED-EXTRACTOR: Erro no ciclo financeiro:', erro);

            // Manter valores padrão em caso de erro
            cicloFinanceiro.observacoes.push(`Erro no cálculo: ${erro.message}. Utilizando valores estimados.`);
        }

        return cicloFinanceiro;
    }

    /**
     * Calcula indicadores derivados do ciclo financeiro (versão corrigida)
     */
    function calcularIndicadoresCicloCorrigido(cicloFinanceiro, log) {
        try {
            cicloFinanceiro.cicloOperacional = cicloFinanceiro.pmr + cicloFinanceiro.pme;
            cicloFinanceiro.cicloFinanceiroLiquido = cicloFinanceiro.cicloOperacional - cicloFinanceiro.pmp;

            // Garantir valores mínimos razoáveis
            cicloFinanceiro.cicloFinanceiroLiquido = Math.max(cicloFinanceiro.cicloFinanceiroLiquido, 5);

            log.push(`     ⏱️ Indicadores do ciclo:`);
            log.push(`        PMR: ${cicloFinanceiro.pmr} dias`);
            log.push(`        PME: ${cicloFinanceiro.pme} dias`);
            log.push(`        PMP: ${cicloFinanceiro.pmp} dias`);
            log.push(`        Ciclo Operacional: ${cicloFinanceiro.cicloOperacional} dias`);
            log.push(`        Ciclo Financeiro Líquido: ${cicloFinanceiro.cicloFinanceiroLiquido} dias`);

        } catch (erro) {
            log.push(`     ❌ Erro ao calcular indicadores do ciclo: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Processa demonstrações fiscais do ECF
     * @param {Object} ecf - Dados do ECF
     * @param {Object} dadosFinanceiros - Objeto de dados financeiros
     * @param {Array} log - Array de log
     */
    function processarDemonstracoesFiscais(ecf, dadosFinanceiros, log) {
        if (!ecf.registros) {
            log.push('     ⚠️ Registros do ECF não encontrados');
            return;
        }

        try {
            // Processar DRE (J100 - Receitas, J150 - Custos, J200 - Resultado)
            if (ecf.registros.J100) {
                ecf.registros.J100.forEach(registro => {
                    const receitaBruta = parseFloat(registro.VL_REC_BRT) || 0;
                    const receitaLiquida = parseFloat(registro.VL_REC_LIQ) || 0;
                    
                    dadosFinanceiros.receitas.receitaBruta += receitaBruta;
                    dadosFinanceiros.receitas.receitaLiquida += receitaLiquida;
                });
            }

            if (ecf.registros.J150) {
                ecf.registros.J150.forEach(registro => {
                    const custoTotal = parseFloat(registro.VL_CUSTO) || 0;
                    dadosFinanceiros.custos.custoTotal += custoTotal;
                });
            }

            if (ecf.registros.J200) {
                ecf.registros.J200.forEach(registro => {
                    const lucroOperacional = parseFloat(registro.VL_LUCRO_OPER) || 0;
                    const lucroLiquido = parseFloat(registro.VL_LUCRO_LIQ) || 0;
                    
                    dadosFinanceiros.resultado.lucroOperacional += lucroOperacional;
                    dadosFinanceiros.resultado.lucroLiquido += lucroLiquido;
                });
            }

            dadosFinanceiros.fonte.push('ECF');
            log.push(`     📊 ECF processado - Receita bruta: R$ ${dadosFinanceiros.receitas.receitaBruta.toFixed(2)}`);

        } catch (erro) {
            log.push(`     ❌ Erro ao processar ECF: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Processa demonstrações contábeis do ECD
     * @param {Object} ecd - Dados do ECD
     * @param {Object} dadosFinanceiros - Objeto de dados financeiros
     * @param {Array} log - Array de log
     */
    function processarDemonstracoesContabeis(ecd, dadosFinanceiros, log) {
        if (!ecd.registros) {
            log.push('     ⚠️ Registros do ECD não encontrados');
            return;
        }

        try {
            // Processar Balanço Patrimonial (J100)
            if (ecd.registros.J100) {
                // Dados do balanço para complementar análises
                log.push('     📋 Dados do Balanço Patrimonial identificados');
            }

            // Processar DRE detalhada (J200, J210)
            if (ecd.registros.J200) {
                ecd.registros.J200.forEach(registro => {
                    // Complementar dados de receitas e custos se disponível
                    const conta = registro.COD_CTA || '';
                    const valor = parseFloat(registro.VL_CTA) || 0;
                    
                    // Mapear contas baseado no plano de contas
                    if (conta.startsWith('3.1')) { // Receitas
                        dadosFinanceiros.receitas.receitaOperacional += valor;
                    } else if (conta.startsWith('3.2')) { // Custos
                        dadosFinanceiros.custos.custoTotal += valor;
                    } else if (conta.startsWith('3.3')) { // Despesas
                        dadosFinanceiros.despesas.despesasOperacionais += valor;
                    }
                });
            }

            dadosFinanceiros.fonte.push('ECD');
            log.push('     📋 ECD processado para complementar dados financeiros');

        } catch (erro) {
            log.push(`     ❌ Erro ao processar ECD: ${erro.message}`);
            console.error('SPED-EXTRACTOR: Erro no ECD:', erro);
        }
    }

    /**
     * Complementa dados financeiros com informações do SPED Contribuições
     * @param {Object} spedContrib - Dados do SPED Contribuições
     * @param {Object} dadosFinanceiros - Objeto de dados financeiros
     * @param {Array} log - Array de log
     */
    function complementarComContribuicoes(spedContrib, dadosFinanceiros, log) {
        if (!spedContrib.registros) {
            log.push('     ⚠️ Registros do SPED Contribuições não encontrados');
            return;
        }

        try {
            // Complementar receitas se não foram obtidas de outras fontes
            if (spedContrib.registros.A100 && dadosFinanceiros.receitas.receitaBruta === 0) {
                spedContrib.registros.A100.forEach(registro => {
                    const receitaBruta = parseFloat(registro.VL_REC_BRT) || 0;
                    dadosFinanceiros.receitas.receitaBruta += receitaBruta;
                });
            }

            // Complementar custos (A200)
            if (spedContrib.registros.A200) {
                spedContrib.registros.A200.forEach(registro => {
                    const custoTotal = parseFloat(registro.VL_CUSTO) || 0;
                    dadosFinanceiros.custos.custoTotal += custoTotal;
                });
            }

            dadosFinanceiros.fonte.push('SPED Contribuições');
            log.push('     💼 Dados complementados com SPED Contribuições');

        } catch (erro) {
            log.push(`     ❌ Erro ao complementar com SPED Contribuições: ${erro.message}`);
            console.error('SPED-EXTRACTOR: Erro ao complementar dados:', erro);
        }
    }

    /**
     * Calcula resultados financeiros derivados
     * @param {Object} dadosFinanceiros - Dados financeiros
     * @param {Array} log - Array de log
     */
    function calcularResultadosFinanceiros(dadosFinanceiros, log) {
        try {
            // Calcular lucro bruto
            dadosFinanceiros.resultado.lucroBruto = 
                dadosFinanceiros.receitas.receitaLiquida - dadosFinanceiros.custos.custoTotal;

            // Se não temos lucro operacional calculado, estimar
            if (dadosFinanceiros.resultado.lucroOperacional === 0) {
                dadosFinanceiros.resultado.lucroOperacional = 
                    dadosFinanceiros.resultado.lucroBruto - dadosFinanceiros.despesas.despesasOperacionais;
            }

            // Se não temos lucro líquido, usar operacional como base
            if (dadosFinanceiros.resultado.lucroLiquido === 0) {
                dadosFinanceiros.resultado.lucroLiquido = dadosFinanceiros.resultado.lucroOperacional;
            }

            log.push(`     💰 Resultados calculados:`);
            log.push(`        Lucro Bruto: R$ ${dadosFinanceiros.resultado.lucroBruto.toFixed(2)}`);
            log.push(`        Lucro Operacional: R$ ${dadosFinanceiros.resultado.lucroOperacional.toFixed(2)}`);
            log.push(`        Lucro Líquido: R$ ${dadosFinanceiros.resultado.lucroLiquido.toFixed(2)}`);

        } catch (erro) {
            log.push(`     ❌ Erro ao calcular resultados: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Calcula margens operacionais
     * @param {Object} dadosFinanceiros - Dados financeiros
     * @param {Array} log - Array de log
     */
    function calcularMargensOperacionais(dadosFinanceiros, log) {
        const receitaBase = dadosFinanceiros.receitas.receitaLiquida || dadosFinanceiros.receitas.receitaBruta;
        
        if (receitaBase <= 0) {
            log.push('     ⚠️ Receita zero ou negativa - não é possível calcular margens');
            return;
        }

        try {
            dadosFinanceiros.resultado.margemBruta = 
                (dadosFinanceiros.resultado.lucroBruto / receitaBase) * 100;

            dadosFinanceiros.resultado.margemOperacional = 
                (dadosFinanceiros.resultado.lucroOperacional / receitaBase) * 100;

            dadosFinanceiros.resultado.margemLiquida = 
                (dadosFinanceiros.resultado.lucroLiquido / receitaBase) * 100;

            log.push(`     📊 Margens calculadas:`);
            log.push(`        Margem Bruta: ${dadosFinanceiros.resultado.margemBruta.toFixed(2)}%`);
            log.push(`        Margem Operacional: ${dadosFinanceiros.resultado.margemOperacional.toFixed(2)}%`);
            log.push(`        Margem Líquida: ${dadosFinanceiros.resultado.margemLiquida.toFixed(2)}%`);

        } catch (erro) {
            log.push(`     ❌ Erro ao calcular margens: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Calcula ciclo financeiro da empresa
     * @param {Object} speds - Dados dos SPEDs
     * @param {Object} dadosFinanceiros - Dados financeiros
     * @param {Object} opcoes - Opções de processamento
     * @param {Array} log - Array de log
     * @returns {Object} Dados do ciclo financeiro
     */
    function calcularCicloFinanceiro(speds, dadosFinanceiros, opcoes, log) {
        const cicloFinanceiro = {
            pmr: 30,  // Prazo Médio de Recebimento (dias)
            pme: 30,  // Prazo Médio de Estoque (dias)
            pmp: 30,  // Prazo Médio de Pagamento (dias)
            cicloOperacional: 60,     // PMR + PME
            cicloFinanceiroLiquido: 30,  // Ciclo Operacional - PMP
            giroAtivos: 0,
            giroEstoque: 0,
            fonte: [],
            observacoes: [],
            estimado: true
        };

        try {
            // Tentar extrair dados reais do fluxo de caixa (ECD)
            if (speds['sped-ecd'] || speds.ecd) {
                log.push('   ⏱️ Analisando fluxo de caixa do ECD...');
                analisarFluxoCaixaECD(speds['sped-ecd'] || speds.ecd, cicloFinanceiro, log);
            }

            // Estimar baseado nos dados financeiros disponíveis
            if (dadosFinanceiros.receitas.receitaLiquida > 0) {
                log.push('   📊 Estimando ciclo baseado nos dados financeiros...');
                estimarCicloFinanceiro(dadosFinanceiros, cicloFinanceiro, log);
            }

            // Calcular indicadores derivados
            calcularIndicadoresCiclo(cicloFinanceiro, log);

            // Validar razoabilidade dos valores
            validarCicloFinanceiro(cicloFinanceiro, log);

            log.push(`   ✅ Ciclo financeiro calculado: ${cicloFinanceiro.cicloFinanceiroLiquido} dias`);

        } catch (erro) {
            log.push(`   ❌ Erro ao calcular ciclo financeiro: ${erro.message}`);
            console.error('SPED-EXTRACTOR: Erro no ciclo financeiro:', erro);
            
            // Manter valores padrão em caso de erro
            cicloFinanceiro.observacoes.push(`Erro no cálculo: ${erro.message}. Utilizando valores estimados.`);
        }

        return cicloFinanceiro;
    }

    /**
     * Analisa fluxo de caixa do ECD para extrair ciclo real
     * @param {Object} ecd - Dados do ECD
     * @param {Object} cicloFinanceiro - Objeto do ciclo financeiro
     * @param {Array} log - Array de log
     */
    function analisarFluxoCaixaECD(ecd, cicloFinanceiro, log) {
        if (!ecd.registros || !ecd.registros.J800) {
            log.push('     ⚠️ Dados de fluxo de caixa não encontrados no ECD');
            return;
        }

        try {
            // Analisar demonstração de fluxo de caixa
            ecd.registros.J800.forEach(registro => {
                const conta = registro.COD_CTA || '';
                const valor = parseFloat(registro.VL_CTA) || 0;
                
                // Identificar variações no capital de giro
                if (conta.includes('RECEB') || conta.includes('CLIENTE')) {
                    // Dados de recebimento podem indicar PMR
                    log.push('     📋 Dados de recebimento identificados no fluxo de caixa');
                }
                
                if (conta.includes('FORNEC') || conta.includes('PAGAMENTO')) {
                    // Dados de pagamento podem indicar PMP
                    log.push('     📋 Dados de pagamento identificados no fluxo de caixa');
                }
            });

            cicloFinanceiro.fonte.push('ECD - Fluxo de Caixa');
            cicloFinanceiro.estimado = false;

        } catch (erro) {
            log.push(`     ❌ Erro ao analisar fluxo de caixa: ${erro.message}`);
        }
    }

    /**
     * Estima ciclo financeiro baseado nos dados financeiros
     * @param {Object} dadosFinanceiros - Dados financeiros
     * @param {Object} cicloFinanceiro - Objeto do ciclo financeiro
     * @param {Array} log - Array de log
     */
    function estimarCicloFinanceiro(dadosFinanceiros, cicloFinanceiro, log) {
        try {
            const receitaAnual = dadosFinanceiros.receitas.receitaLiquida;
            const custoAnual = dadosFinanceiros.custos.custoTotal;

            if (receitaAnual > 0) {
                // Estimar giro dos ativos (simplificado)
                cicloFinanceiro.giroAtivos = receitaAnual / (receitaAnual * 0.8); // Estimativa conservadora
                
                // Estimar PMR baseado no tipo de negócio (padrão: 30 dias)
                cicloFinanceiro.pmr = 30;
                
                // Estimar PME baseado no giro de estoque
                if (custoAnual > 0) {
                    cicloFinanceiro.giroEstoque = receitaAnual / custoAnual;
                    cicloFinanceiro.pme = 365 / Math.max(cicloFinanceiro.giroEstoque * 4, 4); // Mínimo 4 giros/ano
                }

                log.push(`     📊 Estimativas baseadas em dados financeiros:`);
                log.push(`        PMR estimado: ${cicloFinanceiro.pmr} dias`);
                log.push(`        PME estimado: ${cicloFinanceiro.pme.toFixed(0)} dias`);
            }

            cicloFinanceiro.fonte.push('Estimativa baseada em dados financeiros');

        } catch (erro) {
            log.push(`     ❌ Erro na estimativa do ciclo: ${erro.message}`);
        }
    }

    /**
     * Calcula indicadores derivados do ciclo financeiro
     * @param {Object} cicloFinanceiro - Objeto do ciclo financeiro
     * @param {Array} log - Array de log
     */
    function calcularIndicadoresCiclo(cicloFinanceiro, log) {
        try {
            cicloFinanceiro.cicloOperacional = cicloFinanceiro.pmr + cicloFinanceiro.pme;
            cicloFinanceiro.cicloFinanceiroLiquido = cicloFinanceiro.cicloOperacional - cicloFinanceiro.pmp;

            log.push(`     ⏱️ Indicadores do ciclo:`);
            log.push(`        Ciclo Operacional: ${cicloFinanceiro.cicloOperacional} dias`);
            log.push(`        Ciclo Financeiro Líquido: ${cicloFinanceiro.cicloFinanceiroLiquido} dias`);

        } catch (erro) {
            log.push(`     ❌ Erro ao calcular indicadores do ciclo: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Processa cenário de transição tributária
     * @param {Object} composicaoAtual - Composição tributária atual
     * @param {Object} parametrosIVA - Parâmetros do IVA Dual
     * @param {Array} log - Array de log
     * @returns {Object} Dados da transição tributária
     */
    function processarTransicaoTributaria(composicaoAtual, parametrosIVA, log) {
        const transicao = {
            cronograma: CONFIG.cronogramaTransicao,
            projecoesPorAno: {},
            resumoTransicao: {
                impactoTotal: 0,
                variacao: {
                    pis: 0,
                    cofins: 0,
                    icms: 0,
                    ipi: 0,
                    iss: 0,
                    total: 0
                },
                aliquotaFinal: parametrosIVA.total
            },
            observacoes: []
        };

        try {
            log.push('   📈 Calculando projeções da transição tributária...');

            // Calcular projeções para cada ano da transição
            Object.keys(CONFIG.cronogramaTransicao).forEach(ano => {
                const anoNum = parseInt(ano);
                const percentuais = CONFIG.cronogramaTransicao[ano];
                
                const projecaoAno = calcularProjecaoAno(
                    anoNum, 
                    percentuais, 
                    composicaoAtual, 
                    parametrosIVA,
                    log
                );
                
                transicao.projecoesPorAno[ano] = projecaoAno;
            });

            // Calcular resumo da transição
            calcularResumoTransicao(transicao, composicaoAtual, parametrosIVA, log);

            // Gerar observações sobre a transição
            gerarObservacoesTransicao(transicao, composicaoAtual, log);

            log.push(`   ✅ Transição tributária processada - Impacto total: R$ ${transicao.resumoTransicao.impactoTotal.toFixed(2)}`);

        } catch (erro) {
            log.push(`   ❌ Erro ao processar transição tributária: ${erro.message}`);
            console.error('SPED-EXTRACTOR: Erro na transição tributária:', erro);
            throw erro;
        }

        return transicao;
    }

    /**
     * Calcula projeção tributária para um ano específico
     * @param {number} ano - Ano da projeção
     * @param {Object} percentuais - Percentuais de participação dos sistemas
     * @param {Object} composicaoAtual - Composição tributária atual
     * @param {Object} parametrosIVA - Parâmetros do IVA
     * @param {Array} log - Array de log
     * @returns {Object} Projeção do ano
     */
    function calcularProjecaoAno(ano, percentuais, composicaoAtual, parametrosIVA, log) {
        const projecao = {
            ano: ano,
            percentualSistemaAtual: percentuais.sistemaAtual,
            percentualIVA: percentuais.ivaDual,
            impostosSistemaAtual: {},
            impostosIVA: 0,
            totalImpostos: 0,
            aliquotaEfetiva: 0,
            impactoCapitalGiro: 0
        };

        try {
            // Calcular impostos do sistema atual (proporcionalmente)
            projecao.impostosSistemaAtual = {
                pis: composicaoAtual.impostosLiquidos.pis * percentuais.sistemaAtual,
                cofins: composicaoAtual.impostosLiquidos.cofins * percentuais.sistemaAtual,
                icms: composicaoAtual.impostosLiquidos.icms * percentuais.sistemaAtual,
                ipi: composicaoAtual.impostosLiquidos.ipi * percentuais.sistemaAtual,
                iss: composicaoAtual.impostosLiquidos.iss * percentuais.sistemaAtual,
                total: composicaoAtual.impostosLiquidos.total * percentuais.sistemaAtual
            };

            // Calcular IVA Dual (proporcionalmente)
            projecao.impostosIVA = (composicaoAtual.faturamentoTotal * parametrosIVA.total / 100) * percentuais.ivaDual;

            // Total de impostos no ano
            projecao.totalImpostos = projecao.impostosSistemaAtual.total + projecao.impostosIVA;

            // Alíquota efetiva do ano
            if (composicaoAtual.faturamentoTotal > 0) {
                projecao.aliquotaEfetiva = (projecao.totalImpostos / composicaoAtual.faturamentoTotal) * 100;
            }

            // Estimar impacto no capital de giro (simplificado)
            projecao.impactoCapitalGiro = projecao.impostosIVA * percentuais.ivaDual;

        } catch (erro) {
            log.push(`     ❌ Erro na projeção do ano ${ano}: ${erro.message}`);
            throw erro;
        }

        return projecao;
    }

    /**
     * Calcula resumo geral da transição
     * @param {Object} transicao - Dados da transição
     * @param {Object} composicaoAtual - Composição atual
     * @param {Object} parametrosIVA - Parâmetros IVA
     * @param {Array} log - Array de log
     */
    function calcularResumoTransicao(transicao, composicaoAtual, parametrosIVA, log) {
        try {
            // Calcular impacto total acumulado
            transicao.resumoTransicao.impactoTotal = Object.values(transicao.projecoesPorAno)
                .reduce((total, projecao) => total + projecao.impactoCapitalGiro, 0);

            // Calcular variação final (sistema atual vs IVA total)
            const impostoAtualTotal = composicaoAtual.impostosLiquidos.total;
            const impostoIVATotal = (composicaoAtual.faturamentoTotal * parametrosIVA.total / 100);
            
            transicao.resumoTransicao.variacao.total = impostoIVATotal - impostoAtualTotal;

            log.push(`     📊 Resumo da transição:`);
            log.push(`        Impacto total acumulado: R$ ${transicao.resumoTransicao.impactoTotal.toFixed(2)}`);
            log.push(`        Variação final de carga: R$ ${transicao.resumoTransicao.variacao.total.toFixed(2)}`);
            log.push(`        Nova alíquota efetiva: ${parametrosIVA.total}%`);

        } catch (erro) {
            log.push(`     ❌ Erro no resumo da transição: ${erro.message}`);
            throw erro;
        }
    }

    /**
     * Gera observações específicas sobre a transição
     * @param {Object} transicao - Dados da transição
     * @param {Object} composicaoAtual - Composição atual
     * @param {Array} log - Array de log
     */
    function gerarObservacoesTransicao(transicao, composicaoAtual, log) {
        try {
            const observacoes = [];

            // Comparar carga tributária atual vs final
            const cargaAtual = composicaoAtual.aliquotasEfetivas.total;
            const cargaFinal = transicao.resumoTransicao.aliquotaFinal;

            if (cargaFinal > cargaAtual) {
                observacoes.push(`Aumento de carga tributária: de ${cargaAtual.toFixed(2)}% para ${cargaFinal}%`);
            } else if (cargaFinal < cargaAtual) {
                observacoes.push(`Redução de carga tributária: de ${cargaAtual.toFixed(2)}% para ${cargaFinal}%`);
            } else {
                observacoes.push(`Manutenção da carga tributária em aproximadamente ${cargaAtual.toFixed(2)}%`);
            }

            // Observações sobre o cronograma
            observacoes.push('Transição gradual conforme LC 214/2025 com implementação de 2026 a 2033');
            observacoes.push('Split Payment será implementado progressivamente junto com o IVA Dual');

            // Observações sobre impactos no capital de giro
            if (transicao.resumoTransicao.impactoTotal > 0) {
                observacoes.push('Impacto negativo previsto no capital de giro devido ao Split Payment');
            }

            transicao.observacoes = observacoes;
            log.push(`     📝 ${observacoes.length} observações geradas sobre a transição`);

        } catch (erro) {
            log.push(`     ❌ Erro ao gerar observações: ${erro.message}`);
        }
    }

    /**
     * Valida integridade dos dados processados
     * @param {Object} empresaInfo - Informações da empresa
     * @param {Object} composicaoTributaria - Composição tributária
     * @param {Object} dadosFinanceiros - Dados financeiros
     * @param {Array} log - Array de log
     */
    function validarIntegridadeDados(empresaInfo, composicaoTributaria, dadosFinanceiros, log) {
        const validacoes = [];

        try {
            // Validar consistência de faturamento
            const faturamentoTributario = composicaoTributaria.faturamentoTotal;
            const faturamentoFinanceiro = dadosFinanceiros.receitas.receitaBruta || dadosFinanceiros.receitas.receitaLiquida;

            if (faturamentoTributario > 0 && faturamentoFinanceiro > 0) {
                const diferenca = Math.abs(faturamentoTributario - faturamentoFinanceiro) / faturamentoTributario;
                
                if (diferenca > CONFIG.tolerancias.percentualVariacao) {
                    validacoes.push(`⚠️ Divergência no faturamento: Tributário R$ ${faturamentoTributario.toFixed(2)} vs Financeiro R$ ${faturamentoFinanceiro.toFixed(2)}`);
                } else {
                    validacoes.push(`✅ Faturamento consistente entre bases tributária e financeira`);
                }
            }

            // Validar razoabilidade das alíquotas
            if (composicaoTributaria.aliquotasEfetivas.total > 50) {
                validacoes.push(`⚠️ Alíquota total muito alta: ${composicaoTributaria.aliquotasEfetivas.total.toFixed(2)}% - verificar dados`);
            } else if (composicaoTributaria.aliquotasEfetivas.total < 5) {
                validacoes.push(`⚠️ Alíquota total muito baixa: ${composicaoTributaria.aliquotasEfetivas.total.toFixed(2)}% - verificar regime tributário`);
            } else {
                validacoes.push(`✅ Alíquota efetiva dentro da faixa esperada: ${composicaoTributaria.aliquotasEfetivas.total.toFixed(2)}%`);
            }

            // Validar margem operacional
            if (dadosFinanceiros.resultado.margemOperacional > 50) {
                validacoes.push(`⚠️ Margem operacional muito alta: ${dadosFinanceiros.resultado.margemOperacional.toFixed(2)}% - verificar dados`);
            } else if (dadosFinanceiros.resultado.margemOperacional < -10) {
                validacoes.push(`⚠️ Margem operacional muito negativa: ${dadosFinanceiros.resultado.margemOperacional.toFixed(2)}% - empresa com prejuízo`);
            } else {
                validacoes.push(`✅ Margem operacional dentro da faixa aceitável: ${dadosFinanceiros.resultado.margemOperacional.toFixed(2)}%`);
            }

            log.push(`   🔍 Validação de integridade concluída - ${validacoes.length} verificações realizadas`);
            validacoes.forEach(validacao => log.push(`     ${validacao}`));

        } catch (erro) {
            log.push(`   ❌ Erro na validação de integridade: ${erro.message}`);
        }
    }

    /**
     * Valida composição tributária
     * @param {Object} composicao - Composição tributária
     * @param {Array} log - Array de log
     */
    function validarComposicaoTributaria(composicao, log) {
        try {
            // Verificar se há débitos sem créditos correspondentes (pode indicar erro)
            const impostos = ['pis', 'cofins', 'icms', 'ipi', 'iss'];
            
            impostos.forEach(imposto => {
                if (composicao.debitos[imposto] > 0 && composicao.creditos[imposto] === 0) {
                    composicao.observacoes.push(`${imposto.toUpperCase()}: Apenas débitos encontrados, sem créditos correspondentes`);
                }
                
                if (composicao.creditos[imposto] > composicao.debitos[imposto]) {
                    composicao.observacoes.push(`${imposto.toUpperCase()}: Créditos superiores aos débitos - possível saldo credor`);
                }
            });

            // Verificar total de impostos
            if (composicao.impostosLiquidos.total <= 0) {
                composicao.observacoes.push('Total de impostos líquidos zero ou negativo - verificar dados tributários');
            }

        } catch (erro) {
            log.push(`   ❌ Erro na validação da composição tributária: ${erro.message}`);
        }
    }

    /**
     * Valida dados financeiros
     * @param {Object} dadosFinanceiros - Dados financeiros
     * @param {Array} log - Array de log
     */
    function validarDadosFinanceiros(dadosFinanceiros, log) {
        try {
            // Verificar consistência entre receitas e custos
            if (dadosFinanceiros.custos.custoTotal > dadosFinanceiros.receitas.receitaLiquida) {
                dadosFinanceiros.observacoes.push('Custos superiores à receita líquida - verificar dados');
            }

            // Verificar consistência dos resultados
            const lucroBrutoCalculado = dadosFinanceiros.receitas.receitaLiquida - dadosFinanceiros.custos.custoTotal;
            const diferenca = Math.abs(lucroBrutoCalculado - dadosFinanceiros.resultado.lucroBruto);
            
            if (diferenca > CONFIG.tolerancias.valorMinimo) {
                dadosFinanceiros.observacoes.push('Inconsistência no cálculo do lucro bruto - verificar dados de receitas e custos');
            }

        } catch (erro) {
            log.push(`   ❌ Erro na validação dos dados financeiros: ${erro.message}`);
        }
    }

    /**
     * Valida ciclo financeiro
     * @param {Object} cicloFinanceiro - Dados do ciclo financeiro
     * @param {Array} log - Array de log
     */
    function validarCicloFinanceiro(cicloFinanceiro, log) {
        try {
            // Verificar se os prazos são razoáveis
            if (cicloFinanceiro.pmr > 180) {
                cicloFinanceiro.observacoes.push('PMR muito alto (>180 dias) - verificar se é adequado ao negócio');
            }
            
            if (cicloFinanceiro.pme > 365) {
                cicloFinanceiro.observacoes.push('PME muito alto (>365 dias) - verificar dados de estoque');
            }
            
            if (cicloFinanceiro.pmp > 180) {
                cicloFinanceiro.observacoes.push('PMP muito alto (>180 dias) - verificar dados de fornecedores');
            }

            // Verificar se o ciclo financeiro é positivo (necessidade de capital de giro)
            if (cicloFinanceiro.cicloFinanceiroLiquido < 0) {
                cicloFinanceiro.observacoes.push('Ciclo financeiro negativo - empresa tem folga no capital de giro');
            }

        } catch (erro) {
            log.push(`   ❌ Erro na validação do ciclo financeiro: ${erro.message}`);
        }
    }

    /**
     * Gera observações gerais sobre os dados processados
     * @param {Object} empresaInfo - Informações da empresa
     * @param {Object} composicaoTributaria - Composição tributária
     * @param {Object} dadosFinanceiros - Dados financeiros
     * @param {Array} log - Array de log
     * @returns {Array} Array de observações
     */
    function gerarObservacoes(empresaInfo, composicaoTributaria, dadosFinanceiros, log) {
        const observacoes = [];

        try {
            // Observações sobre regime tributário
            if (composicaoTributaria.aliquotasEfetivas.total < 10) {
                observacoes.push('Empresa provavelmente enquadrada no Simples Nacional devido à baixa carga tributária');
            } else if (composicaoTributaria.aliquotasEfetivas.total > 25) {
                observacoes.push('Empresa com alta carga tributária - possivelmente Lucro Real com poucos créditos');
            }

            // Observações sobre situação financeira
            if (dadosFinanceiros.resultado.margemOperacional > 15) {
                observacoes.push('Empresa com boa margem operacional - situação financeira favorável');
            } else if (dadosFinanceiros.resultado.margemOperacional < 5) {
                observacoes.push('Empresa com margem operacional baixa - atenção à eficiência operacional');
            }

            // Observações sobre fontes de dados
            const fontes = [...new Set([
                ...composicaoTributaria.fonte,
                ...dadosFinanceiros.fonte
            ])];
            
            observacoes.push(`Dados extraídos de: ${fontes.join(', ')}`);

            log.push(`   📝 ${observacoes.length} observações gerais geradas`);

        } catch (erro) {
            log.push(`   ❌ Erro ao gerar observações: ${erro.message}`);
        }

        return observacoes;
    }

    /**
     * Avalia qualidade dos dados processados
     * @param {Object} speds - Dados originais dos SPEDs
     * @param {Object} composicaoTributaria - Composição tributária
     * @param {Object} dadosFinanceiros - Dados financeiros
     * @returns {Object} Avaliação da qualidade
     */
    function avaliarQualidadeDados(speds, composicaoTributaria, dadosFinanceiros) {
        const avaliacao = {
            pontuacao: 0,
            nivel: 'Baixo',
            criterios: {
                completudeDados: 0,
                consistenciaInterna: 0,
                razoabilidadeValores: 0,
                diversidadeFontes: 0
            },
            recomendacoes: []
        };

        try {
            // Avaliar completude dos dados (0-25 pontos)
            let pontuacaoCompletude = 0;
            if (composicaoTributaria.faturamentoTotal > 0) pontuacaoCompletude += 10;
            if (composicaoTributaria.impostosLiquidos.total > 0) pontuacaoCompletude += 10;
            if (dadosFinanceiros.receitas.receitaLiquida > 0) pontuacaoCompletude += 5;
            avaliacao.criterios.completudeDados = pontuacaoCompletude;

            // Avaliar consistência interna (0-25 pontos)
            let pontuacaoConsistencia = 15; // Base
            if (composicaoTributaria.observacoes.length > 3) pontuacaoConsistencia -= 5;
            if (dadosFinanceiros.observacoes.length > 3) pontuacaoConsistencia -= 5;
            avaliacao.criterios.consistenciaInterna = Math.max(0, pontuacaoConsistencia);

            // Avaliar razoabilidade dos valores (0-25 pontos)
            let pontuacaoRazoabilidade = 20; // Base
            if (composicaoTributaria.aliquotasEfetivas.total > 50 || composicaoTributaria.aliquotasEfetivas.total < 2) {
                pontuacaoRazoabilidade -= 10;
            }
            if (Math.abs(dadosFinanceiros.resultado.margemOperacional) > 50) {
                pontuacaoRazoabilidade -= 5;
            }
            avaliacao.criterios.razoabilidadeValores = Math.max(0, pontuacaoRazoabilidade);

            // Avaliar diversidade de fontes (0-25 pontos)
            const tiposSped = Object.keys(speds).length;
            const pontuacaoDiversidade = Math.min(25, tiposSped * 8);
            avaliacao.criterios.diversidadeFontes = pontuacaoDiversidade;

            // Calcular pontuação total
            avaliacao.pontuacao = Object.values(avaliacao.criterios).reduce((sum, valor) => sum + valor, 0);

            // Determinar nível
            if (avaliacao.pontuacao >= 80) {
                avaliacao.nivel = 'Alto';
            } else if (avaliacao.pontuacao >= 60) {
                avaliacao.nivel = 'Médio';
            } else {
                avaliacao.nivel = 'Baixo';
            }

            // Gerar recomendações
            if (avaliacao.criterios.completudeDados < 20) {
                avaliacao.recomendacoes.push('Importar mais tipos de SPED para completar os dados');
            }
            if (avaliacao.criterios.consistenciaInterna < 15) {
                avaliacao.recomendacoes.push('Verificar inconsistências nos dados importados');
            }
            if (avaliacao.criterios.razoabilidadeValores < 15) {
                avaliacao.recomendacoes.push('Validar valores que parecem fora do padrão esperado');
            }

        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro na avaliação de qualidade:', erro);
            avaliacao.recomendacoes.push('Erro na avaliação - revisar dados importados');
        }

        return avaliacao;
    }

    // Interface pública do módulo
    return {
        processarDadosConsolidados,
        CONFIG,
        
        // Funções auxiliares expostas para testes
        extrairInformacoesEmpresa,
        processarComposicaoTributaria,
        extrairDadosFinanceiros,
        calcularCicloFinanceiro,
        processarTransicaoTributaria,
        validarIntegridadeDados,
        avaliarQualidadeDados
    };
})();