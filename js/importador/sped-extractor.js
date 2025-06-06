/**
 * SpedExtractor - Módulo melhorado para extração de dados do SPED
 * Versão corrigida para integração com o simulador Split Payment
 * VERSÃO ATUALIZADA COM NOVO LAYOUT - Maio 2025
 */

/**
 * Converte uma string para valor monetário de forma robusta
 * @param {string|number} valorString - String ou número representando valor monetário
 * @returns {number} - Valor convertido como número
 */
function parseValorMonetario(valorString) {
    // Verificar se valor é válido
    if (!valorString || valorString === '' || valorString === '0' || valorString === 'null') {
        return 0;
    }
    
    try {
        // Se já for um número, retornar diretamente
        if (typeof valorString === 'number') {
            return isNaN(valorString) ? 0 : valorString;
        }
        
        // Converter para string e remover espaços
        let valor = valorString.toString().trim();
        
        // Tratar formato brasileiro: 1.234.567,89
        if (valor.includes(',')) {
            const partes = valor.split(',');
            if (partes.length === 2) {
                // Remover separadores de milhar da parte inteira
                const parteInteira = partes[0].replace(/\./g, '');
                const parteDecimal = partes[1];
                valor = parteInteira + '.' + parteDecimal;
            }
        } else {
            // Se não tem vírgula, verificar se tem pontos
            const pontos = valor.split('.');
            if (pontos.length > 2) {
                // Múltiplos pontos = separadores de milhar
                valor = valor.replace(/\./g, '');
            }
            // Se tem apenas um ponto, pode ser decimal em formato americano
        }
        
        const resultado = parseFloat(valor);
        return isNaN(resultado) ? 0 : resultado;
        
    } catch (erro) {
        console.warn('SPED-EXTRACTOR: Erro ao converter valor monetário:', valorString, erro);
        return 0;
    }
}

/**
 * Sistema de rastreamento da fonte dos dados
 */
const FonteDados = {
    SPED: 'sped',
    ESTIMADO: 'estimado',
    CALCULADO: 'calculado'
};

/**
 * Cria objeto com rastreamento de fonte
 */
function criarValorComFonte(valor, fonte = FonteDados.SPED, metadados = {}) {
    return {
        valor: parseValorMonetario(valor),
        fonte: fonte,
        metadados: {
            timestamp: new Date().toISOString(),
            ...metadados
        }
    };
}

/**
 * Extrai apenas o valor numérico, ignorando metadados de fonte
 */
function extrairValorNumerico(dadoComFonte) {
    if (typeof dadoComFonte === 'number') {
        return dadoComFonte;
    }
    if (dadoComFonte && typeof dadoComFonte === 'object' && dadoComFonte.valor !== undefined) {
        return dadoComFonte.valor;
    }
    return parseValorMonetario(dadoComFonte);
}

/**
 * Extrai e normaliza um valor percentual
 */
function extrairValorPercentual(valor) {
    if (typeof valor === 'number') {
        // Se já for um número, verificar se está em formato decimal e converter para percentual se necessário
        if (valor > 0 && valor <= 1) {
            return valor * 100;
        }
        return valor;
    }
    if (valor && typeof valor === 'object' && valor.valor !== undefined) {
        return extrairValorPercentual(valor.valor);
    }
    
    // Tentar converter string para número
    const valorNumerico = parseFloat(valor);
    if (!isNaN(valorNumerico)) {
        if (valorNumerico > 0 && valorNumerico <= 1) {
            return valorNumerico * 100;
        }
        return valorNumerico;
    }
    
    return 0;
}

/**
 * NOVA FUNÇÃO - Processa registros M215 (ajustes base de cálculo PIS)
 * @param {Array} registrosM215 - Registros de ajuste de base de cálculo
 * @param {Object} registroM210 - Registro pai M210
 * @returns {Object} Resultado do processamento
 */
function processarRegistrosM215(registrosM215, registroM210) {
    if (!registrosM215 || !Array.isArray(registrosM215) || registrosM215.length === 0 || !registroM210) {
        console.log('SPED-EXTRACTOR: Nenhum registro M215 encontrado para processamento');
        return {
            acrescimos: 0,
            reducoes: 0,
            detalhamento: [],
            consistente: true
        };
    }

    console.log(`SPED-EXTRACTOR: Processando ${registrosM215.length} registros M215`);
    
    // Separar por tipo de ajuste (acréscimo ou redução)
    const acrescimos = registrosM215
        .filter(reg => reg.indAjusteBc === '0' || reg.tipoAjuste === 'acrescimo')
        .reduce((total, reg) => total + parseValorMonetario(reg.valorAjusteBc || 0), 0);

    const reducoes = registrosM215
        .filter(reg => reg.indAjusteBc === '1' || reg.tipoAjuste === 'reducao')
        .reduce((total, reg) => total + parseValorMonetario(reg.valorAjusteBc || 0), 0);

    // Verificar consistência com campos 5 e 6 do M210
    const valorAcrescimosM210 = parseValorMonetario(registroM210.valorAjustesAcrescimoBc || 0);
    const valorReducoesM210 = parseValorMonetario(registroM210.valorAjustesReducaoBc || 0);

    // Tolerância de 0.01 para arredondamentos
    const consistenteAcrescimos = Math.abs(acrescimos - valorAcrescimosM210) < 0.01;
    const consistenteReducoes = Math.abs(reducoes - valorReducoesM210) < 0.01;
    const consistente = consistenteAcrescimos && consistenteReducoes;

    // Criar detalhamento dos ajustes
    const detalhamento = registrosM215.map(reg => ({
        tipo: reg.indAjusteBc === '0' || reg.tipoAjuste === 'acrescimo' ? 'acrescimo' : 'reducao',
        codigo: reg.codAjusteBc,
        descricao: reg.descrAjusteBc,
        valor: parseValorMonetario(reg.valorAjusteBc || 0)
    }));

    if (!consistente) {
        console.warn('SPED-EXTRACTOR: Inconsistência entre M215 e M210:', {
            acrescimosM215: acrescimos.toFixed(2),
            acrescimosM210: valorAcrescimosM210.toFixed(2),
            reducaoM215: reducoes.toFixed(2),
            reducaoM210: valorReducoesM210.toFixed(2)
        });
    } else {
        console.log('SPED-EXTRACTOR: Validação entre M215 e M210 consistente');
    }

    return {
        acrescimos,
        reducoes,
        detalhamento,
        consistente
    };
}

/**
 * NOVA FUNÇÃO - Processa registros M615 (ajustes base de cálculo COFINS)
 * @param {Array} registrosM615 - Registros de ajuste de base de cálculo
 * @param {Object} registroM610 - Registro pai M610
 * @returns {Object} Resultado do processamento
 */
function processarRegistrosM615(registrosM615, registroM610) {
    if (!registrosM615 || !Array.isArray(registrosM615) || registrosM615.length === 0 || !registroM610) {
        console.log('SPED-EXTRACTOR: Nenhum registro M615 encontrado para processamento');
        return {
            acrescimos: 0,
            reducoes: 0,
            detalhamento: [],
            consistente: true
        };
    }

    console.log(`SPED-EXTRACTOR: Processando ${registrosM615.length} registros M615`);
    
    // Separar por tipo de ajuste (acréscimo ou redução)
    const acrescimos = registrosM615
        .filter(reg => reg.indAjusteBc === '0' || reg.tipoAjuste === 'acrescimo')
        .reduce((total, reg) => total + parseValorMonetario(reg.valorAjusteBc || 0), 0);

    const reducoes = registrosM615
        .filter(reg => reg.indAjusteBc === '1' || reg.tipoAjuste === 'reducao')
        .reduce((total, reg) => total + parseValorMonetario(reg.valorAjusteBc || 0), 0);

    // Verificar consistência com campos 5 e 6 do M610
    const valorAcrescimosM610 = parseValorMonetario(registroM610.valorAjustesAcrescimoBc || 0);
    const valorReducoesM610 = parseValorMonetario(registroM610.valorAjustesReducaoBc || 0);

    // Tolerância de 0.01 para arredondamentos
    const consistenteAcrescimos = Math.abs(acrescimos - valorAcrescimosM610) < 0.01;
    const consistenteReducoes = Math.abs(reducoes - valorReducoesM610) < 0.01;
    const consistente = consistenteAcrescimos && consistenteReducoes;

    // Criar detalhamento dos ajustes
    const detalhamento = registrosM615.map(reg => ({
        tipo: reg.indAjusteBc === '0' || reg.tipoAjuste === 'acrescimo' ? 'acrescimo' : 'reducao',
        codigo: reg.codAjusteBc,
        descricao: reg.descrAjusteBc,
        valor: parseValorMonetario(reg.valorAjusteBc || 0)
    }));

    if (!consistente) {
        console.warn('SPED-EXTRACTOR: Inconsistência entre M615 e M610:', {
            acrescimosM615: acrescimos.toFixed(2),
            acrescimosM610: valorAcrescimosM610.toFixed(2),
            reducaoM615: reducoes.toFixed(2),
            reducaoM610: valorReducoesM610.toFixed(2)
        });
    } else {
        console.log('SPED-EXTRACTOR: Validação entre M615 e M610 consistente');
    }

    return {
        acrescimos,
        reducoes,
        detalhamento,
        consistente
    };
}

/**
 * NOVA FUNÇÃO - Valida fórmula de base de cálculo ajustada
 * @param {Object} registro - Registro M210 ou M610
 * @param {string} tipoTributo - Tipo do tributo ("PIS" ou "COFINS")
 * @returns {Object} Resultado da validação
 */
function validarBaseCalculoAjustada(registro, tipoTributo) {
    if (!registro) {
        return {
            valida: true,
            divergencia: 0,
            formula: ''
        };
    }

    const baseOriginal = parseValorMonetario(registro.valorBaseCalculoAntes || 0);
    const acrescimos = parseValorMonetario(registro.valorAjustesAcrescimoBc || 0);
    const reducoes = parseValorMonetario(registro.valorAjustesReducaoBc || 0);
    const baseAjustada = parseValorMonetario(registro.valorBaseCalculoAjustada || 0);

    // Fórmula: baseAjustada = baseOriginal + acrescimos - reducoes
    const baseCalculada = baseOriginal + acrescimos - reducoes;
    const divergencia = Math.abs(baseCalculada - baseAjustada);
    const valida = divergencia < 0.01; // Tolerância de 0.01 para arredondamentos

    const formula = `${baseOriginal.toFixed(2)} + ${acrescimos.toFixed(2)} - ${reducoes.toFixed(2)} = ${baseCalculada.toFixed(2)}`;

    if (!valida) {
        console.warn(`SPED-EXTRACTOR: Inconsistência na base de cálculo ajustada de ${tipoTributo}:`, {
            baseOriginal: baseOriginal.toFixed(2),
            acrescimos: acrescimos.toFixed(2),
            reducoes: reducoes.toFixed(2),
            baseCalculada: baseCalculada.toFixed(2),
            baseInformada: baseAjustada.toFixed(2),
            divergencia: divergencia.toFixed(2)
        });
    } else {
        console.log(`SPED-EXTRACTOR: Base de cálculo ajustada de ${tipoTributo} validada com sucesso`);
    }

    return {
        valida,
        divergencia,
        formula,
        baseCalculada
    };
}

/**
 * NOVA FUNÇÃO - Valida fórmula de contribuição final
 * @param {Object} registro - Registro M210 ou M610
 * @param {string} tipoTributo - Tipo do tributo ("PIS" ou "COFINS")
 * @returns {Object} Resultado da validação
 */
function validarContribuicaoFinal(registro, tipoTributo) {
    if (!registro) {
        return {
            valida: true,
            divergencia: 0,
            formula: ''
        };
    }

    const contribuicaoApurada = parseValorMonetario(registro.valorContribApurada || 0);
    const ajustesAcrescimo = parseValorMonetario(registro.valorAjustesAcrescimo || 0);
    const ajustesReducao = parseValorMonetario(registro.valorAjustesReducao || 0);
    const valorContribDiferir = parseValorMonetario(registro.valorContribDiferir || 0);
    const valorContribDiferidaAnt = parseValorMonetario(registro.valorContribDiferidaAnt || 0);
    const contribuicaoFinal = parseValorMonetario(registro.valorContribPeriodo || 0);

    // Fórmula: Campo 16 = Campo 11 + Campo 12 - Campo 13 - Campo 14 + Campo 15
    const contribuicaoCalculada = contribuicaoApurada + ajustesAcrescimo - ajustesReducao - valorContribDiferir + valorContribDiferidaAnt;
    const divergencia = Math.abs(contribuicaoCalculada - contribuicaoFinal);
    
    // Tolerância de 1% conforme documento técnico
    const tolerancia = contribuicaoFinal * 0.01;
    const valida = divergencia <= tolerancia;

    const formula = `${contribuicaoApurada.toFixed(2)} + ${ajustesAcrescimo.toFixed(2)} - ${ajustesReducao.toFixed(2)} - ${valorContribDiferir.toFixed(2)} + ${valorContribDiferidaAnt.toFixed(2)} = ${contribuicaoCalculada.toFixed(2)}`;

    if (!valida) {
        console.warn(`SPED-EXTRACTOR: Inconsistência na contribuição final de ${tipoTributo}:`, {
            contribuicaoApurada: contribuicaoApurada.toFixed(2),
            ajustesAcrescimo: ajustesAcrescimo.toFixed(2),
            ajustesReducao: ajustesReducao.toFixed(2),
            valorContribDiferir: valorContribDiferir.toFixed(2),
            valorContribDiferidaAnt: valorContribDiferidaAnt.toFixed(2),
            contribuicaoCalculada: contribuicaoCalculada.toFixed(2),
            contribuicaoFinal: contribuicaoFinal.toFixed(2),
            divergencia: divergencia.toFixed(2),
            tolerancia: tolerancia.toFixed(2)
        });
    } else {
        console.log(`SPED-EXTRACTOR: Contribuição final de ${tipoTributo} validada com sucesso`);
    }

    return {
        valida,
        divergencia,
        formula,
        contribuicaoCalculada
    };
}

/**
 * NOVA FUNÇÃO - Processa registros M615 (ajustes base de cálculo COFINS)
 * @param {Array} registrosM615 - Registros de ajuste de base de cálculo
 * @param {Object} registroM610 - Registro pai M610
 * @returns {Object} Resultado do processamento
 */
function processarRegistrosM615(registrosM615, registroM610) {
    if (!registrosM615 || !Array.isArray(registrosM615) || registrosM615.length === 0 || !registroM610) {
        console.log('SPED-EXTRACTOR: Nenhum registro M615 encontrado para processamento');
        return {
            acrescimos: 0,
            reducoes: 0,
            detalhamento: [],
            consistente: true
        };
    }

    console.log(`SPED-EXTRACTOR: Processando ${registrosM615.length} registros M615`);
    
    // Separar por tipo de ajuste (acréscimo ou redução)
    const acrescimos = registrosM615
        .filter(reg => reg.indAjusteBc === '0' || reg.tipoAjuste === 'acrescimo')
        .reduce((total, reg) => total + parseValorMonetario(reg.valorAjusteBc || 0), 0);

    const reducoes = registrosM615
        .filter(reg => reg.indAjusteBc === '1' || reg.tipoAjuste === 'reducao')
        .reduce((total, reg) => total + parseValorMonetario(reg.valorAjusteBc || 0), 0);

    // Verificar consistência com campos 5 e 6 do M610
    const valorAcrescimosM610 = parseValorMonetario(registroM610.valorAjustesAcrescimoBc || 0);
    const valorReducoesM610 = parseValorMonetario(registroM610.valorAjustesReducaoBc || 0);

    // Tolerância de 0.01 para arredondamentos
    const consistenteAcrescimos = Math.abs(acrescimos - valorAcrescimosM610) < 0.01;
    const consistenteReducoes = Math.abs(reducoes - valorReducoesM610) < 0.01;
    const consistente = consistenteAcrescimos && consistenteReducoes;

    // Criar detalhamento dos ajustes
    const detalhamento = registrosM615.map(reg => ({
        tipo: reg.indAjusteBc === '0' || reg.tipoAjuste === 'acrescimo' ? 'acrescimo' : 'reducao',
        codigo: reg.codAjusteBc,
        descricao: reg.descrAjusteBc,
        valor: parseValorMonetario(reg.valorAjusteBc || 0)
    }));

    if (!consistente) {
        console.warn('SPED-EXTRACTOR: Inconsistência entre M615 e M610:', {
            acrescimosM615: acrescimos.toFixed(2),
            acrescimosM610: valorAcrescimosM610.toFixed(2),
            reducaoM615: reducoes.toFixed(2),
            reducaoM610: valorReducoesM610.toFixed(2)
        });
    } else {
        console.log('SPED-EXTRACTOR: Validação entre M615 e M610 consistente');
    }

    return {
        acrescimos,
        reducoes,
        detalhamento,
        consistente
    };
}

/**
 * NOVA FUNÇÃO - Valida fórmula de base de cálculo ajustada
 * @param {Object} registro - Registro M210 ou M610
 * @param {string} tipoTributo - Tipo do tributo ("PIS" ou "COFINS")
 * @returns {Object} Resultado da validação
 */
function validarBaseCalculoAjustada(registro, tipoTributo) {
    if (!registro) {
        return {
            valida: true,
            divergencia: 0,
            formula: ''
        };
    }

    const baseOriginal = parseValorMonetario(registro.valorBaseCalculoAntes || 0);
    const acrescimos = parseValorMonetario(registro.valorAjustesAcrescimoBc || 0);
    const reducoes = parseValorMonetario(registro.valorAjustesReducaoBc || 0);
    const baseAjustada = parseValorMonetario(registro.valorBaseCalculoAjustada || 0);

    // Fórmula: baseAjustada = baseOriginal + acrescimos - reducoes
    const baseCalculada = baseOriginal + acrescimos - reducoes;
    const divergencia = Math.abs(baseCalculada - baseAjustada);
    const valida = divergencia < 0.01; // Tolerância de 0.01 para arredondamentos

    const formula = `${baseOriginal.toFixed(2)} + ${acrescimos.toFixed(2)} - ${reducoes.toFixed(2)} = ${baseCalculada.toFixed(2)}`;

    if (!valida) {
        console.warn(`SPED-EXTRACTOR: Inconsistência na base de cálculo ajustada de ${tipoTributo}:`, {
            baseOriginal: baseOriginal.toFixed(2),
            acrescimos: acrescimos.toFixed(2),
            reducoes: reducoes.toFixed(2),
            baseCalculada: baseCalculada.toFixed(2),
            baseInformada: baseAjustada.toFixed(2),
            divergencia: divergencia.toFixed(2)
        });
    } else {
        console.log(`SPED-EXTRACTOR: Base de cálculo ajustada de ${tipoTributo} validada com sucesso`);
    }

    return {
        valida,
        divergencia,
        formula,
        baseCalculada
    };
}

/**
 * NOVA FUNÇÃO - Valida fórmula de contribuição final
 * @param {Object} registro - Registro M210 ou M610
 * @param {string} tipoTributo - Tipo do tributo ("PIS" ou "COFINS")
 * @returns {Object} Resultado da validação
 */
function validarContribuicaoFinal(registro, tipoTributo) {
    if (!registro) {
        return {
            valida: true,
            divergencia: 0,
            formula: ''
        };
    }

    const contribuicaoApurada = parseValorMonetario(registro.valorContribApurada || 0);
    const ajustesAcrescimo = parseValorMonetario(registro.valorAjustesAcrescimo || 0);
    const ajustesReducao = parseValorMonetario(registro.valorAjustesReducao || 0);
    const valorContribDiferir = parseValorMonetario(registro.valorContribDiferir || 0);
    const valorContribDiferidaAnt = parseValorMonetario(registro.valorContribDiferidaAnt || 0);
    const contribuicaoFinal = parseValorMonetario(registro.valorContribPeriodo || 0);

    // Fórmula: Campo 16 = Campo 11 + Campo 12 - Campo 13 - Campo 14 + Campo 15
    const contribuicaoCalculada = contribuicaoApurada + ajustesAcrescimo - ajustesReducao - valorContribDiferir + valorContribDiferidaAnt;
    const divergencia = Math.abs(contribuicaoCalculada - contribuicaoFinal);
    
    // Tolerância de 1% conforme documento técnico
    const tolerancia = contribuicaoFinal * 0.01;
    const valida = divergencia <= tolerancia;

    const formula = `${contribuicaoApurada.toFixed(2)} + ${ajustesAcrescimo.toFixed(2)} - ${ajustesReducao.toFixed(2)} - ${valorContribDiferir.toFixed(2)} + ${valorContribDiferidaAnt.toFixed(2)} = ${contribuicaoCalculada.toFixed(2)}`;

    if (!valida) {
        console.warn(`SPED-EXTRACTOR: Inconsistência na contribuição final de ${tipoTributo}:`, {
            contribuicaoApurada: contribuicaoApurada.toFixed(2),
            ajustesAcrescimo: ajustesAcrescimo.toFixed(2),
            ajustesReducao: ajustesReducao.toFixed(2),
            valorContribDiferir: valorContribDiferir.toFixed(2),
            valorContribDiferidaAnt: valorContribDiferidaAnt.toFixed(2),
            contribuicaoCalculada: contribuicaoCalculada.toFixed(2),
            contribuicaoFinal: contribuicaoFinal.toFixed(2),
            divergencia: divergencia.toFixed(2),
            tolerancia: tolerancia.toFixed(2)
        });
    } else {
        console.log(`SPED-EXTRACTOR: Contribuição final de ${tipoTributo} validada com sucesso`);
    }

    return {
        valida,
        divergencia,
        formula,
        contribuicaoCalculada
    };
}

const SpedExtractor = (function() {

    /**
     * Extrai dados relevantes para o simulador a partir dos dados SPED
     * VERSÃO MELHORADA
     */
    function extrairDadosParaSimulador(dadosSped) {
        console.log('Extraindo dados para simulador...');

        // Estrutura padrão com valores iniciais
        const dados = {
            empresa: {},
            parametrosFiscais: {
                sistemaAtual: {
                    regimeTributario: 'real', // padrão
                    regimePISCOFINS: 'não-cumulativo'
                },
                composicaoTributaria: {
                    debitos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                    creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                    fontesDados: {
                        pis: 'estimado',
                        cofins: 'estimado',
                        icms: 'estimado',
                        ipi: 'estimado',
                        iss: 'estimado'
                    },
                    ajustesBC: {} // Novo campo para ajustes de base de cálculo
                },
                aliquotasEfetivas: {
                    pisEfetivo: 0,
                    cofinsEfetivo: 0,
                    icmsEfetivo: 0,
                    ipiEfetivo: 0,
                    issEfetivo: 0
                },
                parametrosPIS: { aliquota: 1.65, baseCalculo: 100, percentualAproveitamento: 100 },
                parametrosCOFINS: { aliquota: 7.6, baseCalculo: 100, percentualAproveitamento: 100 },
                parametrosICMS: { aliquota: 18, baseCalculo: 60, percentualAproveitamento: 100 }
            },
            cicloFinanceiro: {
                prazoPagamento: 30,
                prazoRecebimento: 30,
                prazoEstoque: 30,
                cicloFinanceiro: 30,
                percentualVista: 5,
                percentualPrazo: 95
            },
            ivaConfig: {
                cbs: 0.088,
                ibs: 0.177,
                categoriaIva: 'standard',
                reducaoEspecial: 0
            },
            validacao: {
                inconsistencias: [],
                confiabilidade: 'alta'
            },
            // Nova estrutura para validações técnicas conforme documento
            validacoesTecnicas: {
                baseCalculoAjustada: {
                    pis: { valida: true, divergencia: 0, formula: '' },
                    cofins: { valida: true, divergencia: 0, formula: '' }
                },
                contribuicaoFinal: {
                    pis: { valida: true, divergencia: 0, formula: '' },
                    cofins: { valida: true, divergencia: 0, formula: '' }
                },
                ajustesDetalhados: {
                    pis: { processado: false, registrosM215: 0, consistente: true },
                    cofins: { processado: false, registrosM615: 0, consistente: true }
                }
            }
        };

        try {
            // Processar dados da empresa
            if (dadosSped.fiscal?.empresa || dadosSped.contribuicoes?.empresa || dadosSped.empresa) {
                dados.empresa = extrairDadosEmpresa({
                    fiscal: dadosSped.fiscal,
                    contribuicoes: dadosSped.contribuicoes,
                    ecf: dadosSped.ecf,
                    empresa: dadosSped.empresa // Suporte direto para estrutura já processada
                });
            }

            // Calcular faturamento mensal correto usando múltiplas fontes
            let faturamentoMensal = 0;

            // Prioridade 1: Dados do SPED Contribuições (mais confiáveis)
            if (dadosSped.contribuicoes?.receitas?.receitaBrutaTotal > 0) {
                faturamentoMensal = dadosSped.contribuicoes.receitas.receitaBrutaTotal;
            } 
            // Prioridade 2: Dados do SPED Fiscal
            else if (dadosSped.fiscal?.totalizadores?.valorTotalSaidas > 0) {
                faturamentoMensal = dadosSped.fiscal.totalizadores.valorTotalSaidas;
            }
            // Prioridade 3: Dados da ECF
            else if (dadosSped.ecf?.dre?.receita_liquida?.valor > 0) {
                faturamentoMensal = dadosSped.ecf.dre.receita_liquida.valor;
            }
            // Prioridade 4: Cálculo baseado em documentos
            else if (dadosSped.documentos?.length > 0) {
                const resultadoFaturamento = calcularFaturamentoPorDocumentos(dadosSped.documentos);
                faturamentoMensal = resultadoFaturamento.faturamentoMensal;
            }

            dados.empresa.faturamento = faturamentoMensal;

            // Processar parâmetros fiscais - SIMPLIFICADO para acessar diretamente os registros específicos
            if (dadosSped.fiscal || dadosSped.contribuicoes) {
                const parametros = calcularParametrosFiscais(dadosSped.fiscal, dadosSped.contribuicoes);
                dados.parametrosFiscais = { ...dados.parametrosFiscais, ...parametros };

                // Transferir dados dos ajustes BC para o resultado final
                if (parametros.composicaoTributaria?.ajustesBC) {
                    dados.parametrosFiscais.composicaoTributaria.ajustesBC = 
                        parametros.composicaoTributaria.ajustesBC;
                }
                
                // Transferir validações técnicas
                if (parametros.validacoesTecnicas) {
                    dados.validacoesTecnicas = parametros.validacoesTecnicas;
                }
            }

            // Extrair ciclo financeiro
            if (dadosSped.saldoClientes || dadosSped.saldoEstoques || dadosSped.saldoFornecedores) {
                const ciclo = extrairCicloFinanceiro(dadosSped);
                dados.cicloFinanceiro = { ...dados.cicloFinanceiro, ...ciclo };
            }

            // Extrair configuração IVA
            if (dadosSped.empresa && dados.parametrosFiscais) {
                const ivaConfig = determinarSetorIVA(dadosSped.empresa, dados.parametrosFiscais);
                dados.ivaConfig = { ...dados.ivaConfig, ...ivaConfig };
            }

            // Validar dados extraídos
            const problemas = validarDadosExtraidos(dados);
            if (problemas.length > 0) {
                dados.validacao.inconsistencias = problemas;
                dados.validacao.confiabilidade = problemas.length > 3 ? 'baixa' : 'média';
            }

            console.log(`Dados extraídos - Faturamento: R$ ${faturamentoMensal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
            console.log(`Confiabilidade: ${dados.validacao.confiabilidade}`);

            return dados;
        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro ao extrair dados:', erro);
            return {
                ...dados,
                // Nova estrutura para validações técnicas conforme documento
                validacoesTecnicas: {
                    baseCalculoAjustada: {
                        pis: { valida: true, divergencia: 0, formula: '' },
                        cofins: { valida: true, divergencia: 0, formula: '' }
                    },
                    contribuicaoFinal: {
                        pis: { valida: true, divergencia: 0, formula: '' },
                        cofins: { valida: true, divergencia: 0, formula: '' }
                    },
                    ajustesDetalhados: {
                        pis: { processado: false, registrosM215: 0, consistente: true },
                        cofins: { processado: false, registrosM615: 0, consistente: true }
                    },
                    ajustesIcmsIpi: {
                        icms: { ajustesAplicados: false, valorAjustesDebito: 0, valorAjustesCredito: 0 },
                        ipi: { ajustesAplicados: false, registrosE210: 0, registrosE220: 0 }
                    }
                }
            };
        }
    }

    /**
     * Valida os dados extraídos para garantir integridade
     * @param {Object} dados - Dados extraídos
     * @returns {Array} - Lista de problemas encontrados
     */
    function validarDadosExtraidos(dados) {
        const problemas = [];

        // Validar empresa
        if (!dados.empresa.nome || dados.empresa.nome.length <= 2) {
            problemas.push('Nome da empresa não encontrado ou inválido');
        }

        if (dados.empresa.faturamento <= 0) {
            problemas.push('Faturamento da empresa não encontrado ou zero');
        }

        // Validar parâmetros fiscais
        const composicao = dados.parametrosFiscais?.composicaoTributaria;
        if (!composicao) {
            problemas.push('Composição tributária não encontrada');
        } else {
            const totalDebitos = Object.values(composicao.debitos || {}).reduce((sum, val) => sum + (val || 0), 0);
            if (totalDebitos <= 0) {
                problemas.push('Nenhum débito tributário encontrado');
            }
        }

        // Validar resultados das validações técnicas
        if (dados.validacoesTecnicas) {
            // Verificar problemas na base de cálculo ajustada
            if (!dados.validacoesTecnicas.baseCalculoAjustada.pis.valida) {
                problemas.push(`Base de cálculo ajustada PIS inválida: ${dados.validacoesTecnicas.baseCalculoAjustada.pis.formula}`);
            }
            
            if (!dados.validacoesTecnicas.baseCalculoAjustada.cofins.valida) {
                problemas.push(`Base de cálculo ajustada COFINS inválida: ${dados.validacoesTecnicas.baseCalculoAjustada.cofins.formula}`);
            }
            
            // Verificar problemas na contribuição final
            if (!dados.validacoesTecnicas.contribuicaoFinal.pis.valida) {
                problemas.push(`Contribuição final PIS inválida: ${dados.validacoesTecnicas.contribuicaoFinal.pis.formula}`);
            }
            
            if (!dados.validacoesTecnicas.contribuicaoFinal.cofins.valida) {
                problemas.push(`Contribuição final COFINS inválida: ${dados.validacoesTecnicas.contribuicaoFinal.cofins.formula}`);
            }
            
            // Verificar problemas na consistência dos registros de ajuste
            if (!dados.validacoesTecnicas.ajustesDetalhados.pis.consistente) {
                problemas.push(`Inconsistência entre registros M210 e M215 (PIS)`);
            }
            
            if (!dados.validacoesTecnicas.ajustesDetalhados.cofins.consistente) {
                problemas.push(`Inconsistência entre registros M610 e M615 (COFINS)`);
            }
        }

        return problemas;
    }

    /**
     * Cria estrutura vazia para casos de erro
     */
    function criarEstruturaVazia() {
        return {
            empresa: {
                nome: '',
                faturamento: 0,
                margem: 0.15,
                tipoEmpresa: 'comercio',
                regime: 'presumido'
            },
            parametrosFiscais: {
                tipoOperacao: 'b2b',
                regimePisCofins: 'cumulativo',
                creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, cbs: 0, ibs: 0 },
                composicaoTributaria: {
                    debitos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                    creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                    aliquotasEfetivas: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0, total: 0 }
                }
            },
            cicloFinanceiro: { pmr: 30, pmp: 30, pme: 30, percVista: 0.3, percPrazo: 0.7 },
            ivaConfig: { cbs: 0.088, ibs: 0.177, categoriaIva: 'standard', reducaoEspecial: 0 }
        };
    }

    /**
     * Avalia a qualidade dos dados extraídos
     */
    function avaliarQualidadeDados(dadosSped) {
        const pontuacao = {
            empresa: 0,
            fiscal: 0,
            contabil: 0,
            total: 0
        };

        // Avaliação dados da empresa
        if (dadosSped.empresa?.nome) pontuacao.empresa += 25;
        if (dadosSped.empresa?.cnpj) pontuacao.empresa += 25;
        if (dadosSped.empresa?.faturamento > 0) pontuacao.empresa += 50;

        // Avaliação dados fiscais
        const temCreditos = Object.keys(dadosSped.creditos || {}).length > 0;
        const temDebitos = Object.keys(dadosSped.debitos || {}).length > 0;
        if (temCreditos) pontuacao.fiscal += 30;
        if (temDebitos) pontuacao.fiscal += 30;
        if (dadosSped.documentos?.length > 0) pontuacao.fiscal += 40;

        // Avaliação dados contábeis
        if (dadosSped.balancoPatrimonial?.length > 0) pontuacao.contabil += 50;
        if (dadosSped.demonstracaoResultado?.length > 0) pontuacao.contabil += 50;

        pontuacao.total = Math.round((pontuacao.empresa + pontuacao.fiscal + pontuacao.contabil) / 3);

        return {
            pontuacao: pontuacao,
            classificacao: pontuacao.total >= 80 ? 'excelente' : 
                          pontuacao.total >= 60 ? 'boa' : 
                          pontuacao.total >= 40 ? 'regular' : 'insuficiente'
        };
    }

    /**
     * Extrai dados da empresa com validação aprimorada
     */
    function extrairDadosEmpresa(dadosSped) {
        console.log('SPED-EXTRACTOR: Extraindo dados da empresa...');
        console.log('SPED-EXTRACTOR: Dados de entrada:', {
            fiscalEmpresa: dadosSped.fiscal?.empresa ? Object.keys(dadosSped.fiscal.empresa) : 'Não disponível',
            contribuicoesEmpresa: dadosSped.contribuicoes?.empresa ? Object.keys(dadosSped.contribuicoes.empresa) : 'Não disponível',
            empresaDireta: dadosSped.empresa ? Object.keys(dadosSped.empresa) : 'Não disponível'
        });

        let empresa = {
            cnpj: '',
            nome: '',
            faturamentoMensal: 0,
            margem: 0.15,
            tipoEmpresa: 'comercio',
            regime: 'presumido'
        };

        try {
            // Verificar se empresa já existe nas propriedades do objeto
            if (dadosSped.empresa) {
                // Extrair explicitamente os campos que precisamos
                empresa.cnpj = dadosSped.empresa.cnpj || '';

                // Verificar EXPLICITAMENTE todas as possíveis fontes do nome
                if (dadosSped.empresa.nome && dadosSped.empresa.nome.trim() !== '') {
                    empresa.nome = dadosSped.empresa.nome;
                } else if (dadosSped.empresa.nomeEmpresarial && dadosSped.empresa.nomeEmpresarial.trim() !== '') {
                    empresa.nome = dadosSped.empresa.nomeEmpresarial;
                } else if (dadosSped.empresa.razaoSocial && dadosSped.empresa.razaoSocial.trim() !== '') {
                    empresa.nome = dadosSped.empresa.razaoSocial;
                }

                // Outros campos podem ser copiados diretamente
                if (dadosSped.empresa.tipoEmpresa) empresa.tipoEmpresa = dadosSped.empresa.tipoEmpresa;
                if (dadosSped.empresa.regime) empresa.regime = dadosSped.empresa.regime;
                if (dadosSped.empresa.faturamentoMensal) empresa.faturamentoMensal = dadosSped.empresa.faturamentoMensal;
                if (dadosSped.empresa.margem) empresa.margem = dadosSped.empresa.margem;

            } else if (dadosSped.fiscal?.empresa) {
                console.log('SPED-EXTRACTOR: Usando dados da empresa do SPED Fiscal');
                empresa.cnpj = dadosSped.fiscal.empresa.cnpj || '';

                // Verificar explicitamente todas as possíveis fontes do nome
                if (dadosSped.fiscal.empresa.nome && dadosSped.fiscal.empresa.nome.trim() !== '') {
                    empresa.nome = dadosSped.fiscal.empresa.nome;
                } else if (dadosSped.fiscal.empresa.nomeEmpresarial && dadosSped.fiscal.empresa.nomeEmpresarial.trim() !== '') {
                    empresa.nome = dadosSped.fiscal.empresa.nomeEmpresarial;
                } else if (dadosSped.fiscal.empresa.razaoSocial && dadosSped.fiscal.empresa.razaoSocial.trim() !== '') {
                    empresa.nome = dadosSped.fiscal.empresa.razaoSocial;
                }

                // Determinar tipo de empresa com base no SPED Fiscal
                empresa.tipoEmpresa = determinarTipoEmpresa(dadosSped.fiscal);
            } else if (dadosSped.contribuicoes?.empresa) {
                console.log('SPED-EXTRACTOR: Usando dados da empresa do SPED Contribuições');
                empresa.cnpj = dadosSped.contribuicoes.empresa.cnpj || '';

                // Verificar explicitamente todas as possíveis fontes do nome
                if (dadosSped.contribuicoes.empresa.nome && dadosSped.contribuicoes.empresa.nome.trim() !== '') {
                    empresa.nome = dadosSped.contribuicoes.empresa.nome;
                } else if (dadosSped.contribuicoes.empresa.nomeEmpresarial && dadosSped.contribuicoes.empresa.nomeEmpresarial.trim() !== '') {
                    empresa.nome = dadosSped.contribuicoes.empresa.nomeEmpresarial;
                } else if (dadosSped.contribuicoes.empresa.razaoSocial && dadosSped.contribuicoes.empresa.razaoSocial.trim() !== '') {
                    empresa.nome = dadosSped.contribuicoes.empresa.razaoSocial;
                }

                // Determinar regime com base no registro 0110 do SPED Contribuições
                if (dadosSped.contribuicoes.regimes?.pis_cofins?.codigoIncidencia) {
                    const codigo = dadosSped.contribuicoes.regimes.pis_cofins.codigoIncidencia;

                    if (codigo === '1') { // Exclusivamente não-cumulativo
                        empresa.regime = 'real';
                    } else if (codigo === '2') { // Exclusivamente cumulativo
                        empresa.regime = 'presumido';
                    } else if (codigo === '3') { // Misto
                        empresa.regime = 'real'; // Se é misto, provavelmente é Lucro Real
                    }
                }
            }

            // Calcular faturamento com base em várias fontes possíveis
            if (dadosSped.contribuicoes?.receitas?.receitaBrutaTotal > 0) {
                empresa.faturamentoMensal = dadosSped.contribuicoes.receitas.receitaBrutaTotal;
            } else if (dadosSped.fiscal?.totalizadores?.valorTotalSaidas > 0) {
                empresa.faturamentoMensal = dadosSped.fiscal.totalizadores.valorTotalSaidas;
            } else if (dadosSped.ecf?.dre?.receita_liquida?.valor > 0) {
                empresa.faturamentoMensal = dadosSped.ecf.dre.receita_liquida.valor;
            } else if (dadosSped.documentos?.length > 0) {
                const resultadoFaturamento = calcularFaturamentoPorDocumentos(dadosSped.documentos);
                empresa.faturamentoMensal = resultadoFaturamento.faturamentoMensal;
            } else {
                // Tentar método alternativo baseado em impostos
                empresa.faturamentoMensal = estimarFaturamentoPorImpostos(dadosSped);
            }

            // Calcular margem operacional usando dados da ECF, se disponíveis
            if (dadosSped.ecf?.dre?.resultado_operacional?.valor && 
                dadosSped.ecf?.dre?.receita_liquida?.valor > 0) {

                empresa.margem = dadosSped.ecf.dre.resultado_operacional.valor / 
                                dadosSped.ecf.dre.receita_liquida.valor;
            }
            
            // Validação final para garantir que o nome não esteja vazio
            if (!empresa.nome || empresa.nome.trim() === '') {
                console.warn('SPED-EXTRACTOR: Nome da empresa não encontrado em nenhuma fonte!');
                // Definir um nome genérico para evitar usar o CNPJ como fallback
                empresa.nome = "Empresa " + (empresa.cnpj ? `(CNPJ: ${empresa.cnpj})` : "Importada");
            }

            console.log('SPED-EXTRACTOR: Dados da empresa extraídos:', {
                nome: empresa.nome,
                cnpj: empresa.cnpj,
                tipoEmpresa: empresa.tipoEmpresa,
                regime: empresa.regime
            });

            return empresa;
        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro ao extrair dados da empresa:', erro);
            return empresa; // Retorna estrutura padrão em caso de erro
        }
    }

    function calcularFaturamentoPorDocumentos(documentos) {
        if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
            console.warn('SPED-EXTRACTOR: Array de documentos inválido ou vazio');
            return { faturamentoMensal: 0, periodoAnalise: 0 };
        }

        // Filtrar apenas documentos de saída (vendas) e válidos
        const documentosSaida = documentos.filter(doc => 
            doc && typeof doc === 'object' &&
            doc.indOper === '1' && // Saída
            (doc.situacao === '00' || !doc.situacao) && // Documento regular ou sem info de situação
            doc.valorTotal > 0
        );

        console.log(`SPED-EXTRACTOR: Encontrados ${documentosSaida.length} documentos de saída válidos de ${documentos.length} total`);

        if (documentosSaida.length === 0) {
            return { faturamentoMensal: 0, periodoAnalise: 0 };
        }

        let faturamentoTotal = 0;
        let dataInicial = null;
        let dataFinal = null;

        documentosSaida.forEach(doc => {
            // Extrair e validar o valor do documento
            let valorDoc = 0;
            if (typeof doc.valorTotal === 'number') {
                valorDoc = isNaN(doc.valorTotal) ? 0 : doc.valorTotal;
            } else if (typeof doc.valorTotal === 'string') {
                valorDoc = parseValorMonetario(doc.valorTotal);
            }

            // Validar se o valor está dentro de limites razoáveis
            if (valorDoc > 0 && valorDoc < 1000000000) { // Entre 0 e 1 bilhão
                faturamentoTotal += valorDoc;
            } else {
                console.warn(`SPED-EXTRACTOR: Valor anormal ignorado: ${valorDoc}`);
            }

            // Extrair e validar a data de emissão
            if (doc.dataEmissao) {
                const dataDoc = converterDataSped(doc.dataEmissao);
                if (!dataInicial || dataDoc < dataInicial) dataInicial = dataDoc;
                if (!dataFinal || dataDoc > dataFinal) dataFinal = dataDoc;
            }
        });

        // Calcular período de análise em meses
        let mesesPeriodo = 1; // Default para 1 mês se não conseguir calcular
        if (dataInicial && dataFinal) {
            const diffTime = Math.abs(dataFinal - dataInicial);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            mesesPeriodo = Math.max(1, Math.round(diffDays / 30));

            console.log(`SPED-EXTRACTOR: Período de análise: ${dataInicial.toISOString()} a ${dataFinal.toISOString()} (${mesesPeriodo} meses)`);
        }

        const faturamentoMensal = faturamentoTotal / mesesPeriodo;
        console.log(`SPED-EXTRACTOR: Faturamento total: R$ ${faturamentoTotal.toFixed(2)}, Mensal: R$ ${faturamentoMensal.toFixed(2)}`);

        return {
            faturamentoMensal: faturamentoMensal,
            periodoAnalise: mesesPeriodo,
            totalDocumentos: documentosSaida.length,
            faturamentoTotal: faturamentoTotal
        };
    }

    // Função para calcular faturamento mensal
    function calcularFaturamentoMensal(documentos) {
        if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
            console.warn('SPED-EXTRACTOR: Array de documentos inválido ou vazio');
            return 0;
        }

        // Filtrar apenas documentos de saída (vendas) e válidos
        const documentosSaida = documentos.filter(doc => 
            doc && typeof doc === 'object' &&
            doc.indOper === '1' && // Saída
            (doc.situacao === '00' || !doc.situacao) && // Documento regular ou sem info de situação
            doc.valorTotal > 0
        );

        console.log(`SPED-EXTRACTOR: Encontrados ${documentosSaida.length} documentos de saída válidos de ${documentos.length} total`);

        if (documentosSaida.length === 0) {
            return 0;
        }

        let faturamentoTotal = 0;
        let dataInicial = null;
        let dataFinal = null;

        documentosSaida.forEach(doc => {
            // Validar o valor antes de somar
            let valorDoc = 0;
            if (typeof doc.valorTotal === 'number') {
                valorDoc = doc.valorTotal;
            } else if (typeof doc.valorTotal === 'string') {
                valorDoc = parseValorMonetario(doc.valorTotal);
            }

            // Verificar se o valor está dentro de limites razoáveis (entre 0 e 1 bilhão)
            if (valorDoc > 0 && valorDoc < 1000000000) {
                faturamentoTotal += valorDoc;
            } else {
                console.warn(`SPED-EXTRACTOR: Valor anormal ignorado: ${valorDoc}`);
            }

            // Registrar datas para cálculo do período
            if (doc.dataEmissao) {
                const dataDoc = converterDataSped(doc.dataEmissao);
                if (!dataInicial || dataDoc < dataInicial) dataInicial = dataDoc;
                if (!dataFinal || dataDoc > dataFinal) dataFinal = dataDoc;
            }
        });

        // Calcular período de análise em meses
        let mesesPeriodo = 1; // Default para 1 mês se não conseguir calcular
        if (dataInicial && dataFinal) {
            const diffTime = Math.abs(dataFinal - dataInicial);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            mesesPeriodo = Math.max(1, Math.ceil(diffDays / 30));

            console.log(`SPED-EXTRACTOR: Período de análise: ${dataInicial.toISOString()} a ${dataFinal.toISOString()} (${diffDays} dias, aproximadamente ${mesesPeriodo} meses)`);
        }

        // Calcular faturamento médio mensal
        const faturamentoMensal = faturamentoTotal / mesesPeriodo;

        console.log(`SPED-EXTRACTOR: Faturamento total: R$ ${faturamentoTotal.toFixed(2)}, Mensal: R$ ${faturamentoMensal.toFixed(2)}`);

        return faturamentoMensal;
    }

    // Função auxiliar para converter data do formato SPED (DDMMAAAA) para objeto Date
    function converterDataSped(dataSped) {
        if (!dataSped || dataSped.length !== 8) return new Date();

        try {
            const dia = parseInt(dataSped.substring(0, 2));
            const mes = parseInt(dataSped.substring(2, 4)) - 1; // Mês em JS é 0-based
            const ano = parseInt(dataSped.substring(4, 8));

            return new Date(ano, mes, dia);
        } catch (e) {
            console.warn('SPED-EXTRACTOR: Erro ao converter data:', dataSped, e);
            return new Date();
        }
    }

    /**
     * Estima faturamento baseado em débitos de impostos
     */
    function estimarFaturamentoPorImpostos(dadosSped) {
        // Tentar usar débitos de PIS/COFINS
        if (dadosSped.debitos?.pis?.length > 0) {
            const debitoPIS = dadosSped.debitos.pis[0].valorTotalContribuicao || 0;
            if (debitoPIS > 0) {
                // Assumindo alíquota média de 0.65% para PIS cumulativo
                return debitoPIS / 0.0065;
            }
        }

        if (dadosSped.debitos?.cofins?.length > 0) {
            const debitoCOFINS = dadosSped.debitos.cofins[0].valorTotalContribuicao || 0;
            if (debitoCOFINS > 0) {
                // Assumindo alíquota média de 3% para COFINS cumulativo
                return debitoCOFINS / 0.03;
            }
        }

        // Tentar usar débitos de ICMS
        if (dadosSped.debitos?.icms?.length > 0) {
            const debitoICMS = dadosSped.debitos.icms[0].valorTotalDebitos || 0;
            if (debitoICMS > 0) {
                // Assumindo alíquota média de 18% para ICMS
                return debitoICMS / 0.18;
            }
        }

        return 0;
    }
    
    function calcularFaturamentoPorImpostos(dadosSped) {
        if (!dadosSped || typeof dadosSped !== 'object') {
            console.warn('SPED-EXTRACTOR: Dados SPED inválidos para cálculo por impostos');
            return 0;
        }

        // Tentar usar débitos de PIS/COFINS
        if (dadosSped.debitos?.pis?.length > 0) {
            const debitoPIS = extrairValorSeguro(dadosSped.debitos.pis[0], 'valorTotalContribuicao');
            if (debitoPIS > 0) {
                // Assumindo alíquota média de 0.65% para PIS cumulativo
                const faturamentoEstimado = debitoPIS / 0.0065;
                console.log(`SPED-EXTRACTOR: Faturamento estimado por PIS: ${faturamentoEstimado.toFixed(2)}`);
                return faturamentoEstimado;
            }
        }

        if (dadosSped.debitos?.cofins?.length > 0) {
            const debitoCOFINS = extrairValorSeguro(dadosSped.debitos.cofins[0], 'valorTotalContribuicao');
            if (debitoCOFINS > 0) {
                // Assumindo alíquota média de 3% para COFINS cumulativo
                const faturamentoEstimado = debitoCOFINS / 0.03;
                console.log(`SPED-EXTRACTOR: Faturamento estimado por COFINS: ${faturamentoEstimado.toFixed(2)}`);
                return faturamentoEstimado;
            }
        }

        // Tentar usar débitos de ICMS
        if (dadosSped.debitos?.icms?.length > 0) {
            const debitoICMS = extrairValorSeguro(dadosSped.debitos.icms[0], 'valorTotalDebitos');
            if (debitoICMS > 0) {
                // Assumindo alíquota média de 18% para ICMS
                const faturamentoEstimado = debitoICMS / 0.18;
                console.log(`SPED-EXTRACTOR: Faturamento estimado por ICMS: ${faturamentoEstimado.toFixed(2)}`);
                return faturamentoEstimado;
            }
        }

        console.warn('SPED-EXTRACTOR: Não foi possível estimar faturamento por impostos');
        return 0;
    }

    // Função auxiliar para extrair valores de forma segura
    function extrairValorSeguro(objeto, propriedade, valorPadrao = 0) {
        if (!objeto || typeof objeto !== 'object') return valorPadrao;

        const valor = objeto[propriedade];

        if (typeof valor === 'number') {
            // Verificar se o valor está dentro de limites razoáveis
            if (valor > 0 && valor < 1000000000) { // Entre 0 e 1 bilhão
                return valor;
            }
        } else if (typeof valor === 'string') {
            return parseValorMonetario(valor);
        } else if (Array.isArray(objeto) && objeto.length > 0) {
            // Pode ser um array de valores
            const valorArray = objeto.reduce((sum, item) => {
                if (item && item[propriedade]) {
                    const itemValor = typeof item[propriedade] === 'number' ? 
                                     item[propriedade] : 
                                     parseValorMonetario(item[propriedade]);
                    return sum + (itemValor > 0 ? itemValor : 0);
                }
                return sum;
            }, 0);

            if (valorArray > 0) return valorArray;
        }

        return valorPadrao;
    }

    /**
     * Extrai parâmetros fiscais com composição tributária detalhada
     */
    function extrairParametrosFiscais(dadosSped) {
        console.log('SPED-EXTRACTOR: Extraindo parâmetros fiscais');
        console.log('SPED-EXTRACTOR: Estrutura de dados fiscais disponível:', {
            creditos: dadosSped.creditos ? Object.keys(dadosSped.creditos) : 'Nenhum',
            debitos: dadosSped.debitos ? Object.keys(dadosSped.debitos) : 'Nenhum',
            impostos: dadosSped.impostos ? Object.keys(dadosSped.impostos) : 'Nenhum'
        });

        const regimeTributario = determinarRegimeTributario(dadosSped);
        const tipoOperacao = determinarTipoOperacao(dadosSped);
        const regimePisCofins = determinarRegimePisCofins(dadosSped);

        // Calcular dados tributários mensais
        const resultadoFaturamento = calcularFaturamentoPorDocumentos(dadosSped.documentos || []);
        let faturamentoMensal = resultadoFaturamento.faturamentoMensal;

        // Se não encontrou faturamento pelos documentos, tenta método alternativo
        if (faturamentoMensal <= 0) {
            faturamentoMensal = estimarFaturamentoPorImpostos(dadosSped);
        }

        // Garantir que o faturamento está dentro de limites razoáveis
        if (faturamentoMensal <= 0 || faturamentoMensal >= 1000000000) {
            console.warn(`SPED-EXTRACTOR: Faturamento fora dos limites razoáveis: ${faturamentoMensal}. Usando valor padrão.`);
            faturamentoMensal = 0;
        }

        console.log(`SPED-EXTRACTOR: Faturamento efetivo para cálculo de impostos: ${faturamentoMensal}`);

        const composicaoTributaria = {
            debitos: {
                pis: calcularDebitosPIS(dadosSped, faturamentoMensal),
                cofins: calcularDebitosCOFINS(dadosSped, faturamentoMensal),
                icms: calcularDebitosICMS(dadosSped, faturamentoMensal),
                ipi: calcularDebitosIPI(dadosSped, faturamentoMensal),
                iss: calcularDebitosISS(dadosSped, faturamentoMensal)
            },
            creditos: {
                pis: calcularCreditosPIS(dadosSped),
                cofins: calcularCreditosCOFINS(dadosSped),
                icms: calcularCreditosICMS(dadosSped),
                ipi: calcularCreditosIPI(dadosSped),
                iss: 0 // ISS não gera créditos
            },
            aliquotasEfetivas: {},
            fontesDados: {
                pis: dadosSped.debitos?.pis?.length > 0 ? 'sped' : 'estimado',
                cofins: dadosSped.debitos?.cofins?.length > 0 ? 'sped' : 'estimado',
                icms: dadosSped.debitos?.icms?.length > 0 ? 'sped' : 'estimado',
                ipi: dadosSped.debitos?.ipi?.length > 0 ? 'sped' : 'estimado',
                iss: 'estimado'
            }
        };

        // Log detalhado dos valores calculados
        console.log('SPED-EXTRACTOR: Composição tributária calculada:', {
            debitosPIS: composicaoTributaria.debitos.pis,
            debitosCOFINS: composicaoTributaria.debitos.cofins,
            debitosICMS: composicaoTributaria.debitos.icms,
            debitosIPI: composicaoTributaria.debitos.ipi,
            debitosISS: composicaoTributaria.debitos.iss,
            creditosPIS: composicaoTributaria.creditos.pis,
            creditosCOFINS: composicaoTributaria.creditos.cofins,
            creditosICMS: composicaoTributaria.creditos.icms,
            creditosIPI: composicaoTributaria.creditos.ipi
        });

        // Calcular alíquotas efetivas
        if (faturamentoMensal > 0) {
            // Garantir que os débitos e créditos são números válidos
            Object.keys(composicaoTributaria.debitos).forEach(imposto => {
                const debito = validarValorMonetario(composicaoTributaria.debitos[imposto]);
                const credito = validarValorMonetario(composicaoTributaria.creditos[imposto] || 0);

                // Calcular imposto líquido e alíquota efetiva
                const impostoLiquido = Math.max(0, debito - credito);
                const aliquotaEfetiva = (impostoLiquido / faturamentoMensal);

                // Validar e registrar a alíquota
                if (aliquotaEfetiva >= 0 && aliquotaEfetiva <= 1) {
                    composicaoTributaria.aliquotasEfetivas[imposto] = aliquotaEfetiva;
                    console.log(`SPED-EXTRACTOR: Alíquota efetiva de ${imposto} calculada: ${(aliquotaEfetiva * 100).toFixed(2)}%`);
                } else {
                    // Definir valores padrão seguros em caso de cálculo inválido
                    composicaoTributaria.aliquotasEfetivas[imposto] = imposto === 'pis' ? 0.0065 : 
                                                                    imposto === 'cofins' ? 0.03 : 
                                                                    imposto === 'icms' ? 0.18 : 0;
                    console.warn(`SPED-EXTRACTOR: Alíquota efetiva de ${imposto} inválida (${aliquotaEfetiva}), usando padrão`);
                }
            });

            // Calcular alíquota total
            const totalImpostoLiquido = Object.keys(composicaoTributaria.debitos).reduce((total, imposto) => {
                const debito = composicaoTributaria.debitos[imposto];
                const credito = composicaoTributaria.creditos[imposto] || 0;
                return total + Math.max(0, debito - credito);
            }, 0);

            const aliquotaTotal = (totalImpostoLiquido / faturamentoMensal);

            // Validar a alíquota total (deve estar entre 0 e 1)
            if (aliquotaTotal >= 0 && aliquotaTotal <= 1) {
                composicaoTributaria.aliquotasEfetivas.total = aliquotaTotal;
            } else {
                console.warn(`SPED-EXTRACTOR: Alíquota efetiva total fora dos limites: ${aliquotaTotal}`);
                composicaoTributaria.aliquotasEfetivas.total = 0;
            }

            console.log('SPED-EXTRACTOR: Alíquotas efetivas calculadas:', composicaoTributaria.aliquotasEfetivas);
        } else {
            console.warn('SPED-EXTRACTOR: Faturamento zero, não foi possível calcular alíquotas efetivas');
            // Definir alíquotas padrão
            composicaoTributaria.aliquotasEfetivas = {
                pis: 0.0065,
                cofins: 0.03,
                icms: 0.18,
                ipi: 0,
                iss: 0,
                total: 0.2165
            };
        }

        return {
            tipoOperacao: tipoOperacao,
            regimePisCofins: regimePisCofins,
            regime: regimeTributario,
            composicaoTributaria: composicaoTributaria,
            creditos: composicaoTributaria.creditos // Mantém compatibilidade
        };
    }

    /**
     * Calcula débitos de PIS com suporte ao novo layout
     * @param {Object} dadosSped - Dados do SPED processados
     * @param {number} faturamentoMensal - Faturamento mensal para estimativa
     * @returns {number} - Valor total dos débitos de PIS
     */
    function calcularDebitosPIS(dadosSped, faturamentoMensal) {
        console.log('SPED-EXTRACTOR: Calculando débitos PIS');
        console.log('SPED-EXTRACTOR: Estrutura de débitos disponível:', 
            dadosSped.debitos ? Object.keys(dadosSped.debitos) : 'Nenhum');

        // Inicializar objetos para armazenar resultado das validações técnicas
        const validacaoBase = { valida: true, divergencia: 0, formula: '' };
        const validacaoContribuicao = { valida: true, divergencia: 0, formula: '' };
        const validacaoAjustes = { processado: false, registrosM215: 0, consistente: true };

        // PRIORIDADE 1: Dados diretos do SPED Contribuições - registro M210
        if (dadosSped.debitos?.pis?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.debitos.pis.length} registros de débitos PIS`);

            // Debug dos primeiros registros
            const amostraDebitos = dadosSped.debitos.pis.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de débitos PIS:', JSON.stringify(amostraDebitos, null, 2));

            // Verificar se temos registros do tipo M210 (novo layout)
            const registrosM210 = dadosSped.debitos.pis.filter(reg => reg.registro === 'M210');

            if (registrosM210.length > 0) {
                console.log(`SPED-EXTRACTOR: Encontrados ${registrosM210.length} registros M210 (novo layout)`);

                let totalDebitos = 0;
                registrosM210.forEach(debito => {
                    // VALIDAÇÃO TÉCNICA 1: Validar base de cálculo ajustada
                    // Fórmula: Campo 7 = Campo 4 + Campo 5 - Campo 6
                    const resultadoValidacaoBase = validarBaseCalculoAjustada(debito, 'PIS');

                    // Atualizar validação apenas se encontrar problema
                    if (!resultadoValidacaoBase.valida) {
                        validacaoBase.valida = false;
                        validacaoBase.divergencia = resultadoValidacaoBase.divergencia;
                        validacaoBase.formula = resultadoValidacaoBase.formula;
                    }

                    // VALIDAÇÃO TÉCNICA 2: Validar contribuição final
                    // Fórmula: Campo 16 = Campo 11 + Campo 12 - Campo 13 - Campo 14 + Campo 15
                    const resultadoValidacaoContribuicao = validarContribuicaoFinal(debito, 'PIS');

                    // Atualizar validação apenas se encontrar problema
                    if (!resultadoValidacaoContribuicao.valida) {
                        validacaoContribuicao.valida = false;
                        validacaoContribuicao.divergencia = resultadoValidacaoContribuicao.divergencia;
                        validacaoContribuicao.formula = resultadoValidacaoContribuicao.formula;
                    }

                    // PROCESSAMENTO M215: Verificar e processar registros M215 relacionados
                    if (dadosSped.ajustesBaseCalculo?.pis) {
                        const registrosM215 = dadosSped.ajustesBaseCalculo.pis;
                        validacaoAjustes.processado = true;
                        validacaoAjustes.registrosM215 = registrosM215.length;

                        // Processar detalhamento dos ajustes
                        const resultadoM215 = processarRegistrosM215(registrosM215, debito);
                        validacaoAjustes.consistente = resultadoM215.consistente;

                        // Se houver inconsistência entre M215 e M210, registrar alerta
                        if (!resultadoM215.consistente) {
                            console.warn('SPED-EXTRACTOR: Inconsistência entre M210 e M215 - usando valores do registro M210');
                        }
                    }

                    // HIERARQUIA DE PRIORIDADE conforme documento técnico:
                    // 1. Campo VL_CONT_PER (valor final do período - Campo 16)
                    if (debito.valorContribPeriodo !== undefined) {
                        const valor = parseValorMonetario(debito.valorContribPeriodo);
                        if (valor > 0) {
                            totalDebitos += valor;
                            console.log(`SPED-EXTRACTOR: Usando valorContribPeriodo de M210: ${valor.toFixed(2)}`);
                        }
                    }
                    // 2. Campo VL_CONT_APUR (contribuição apurada antes ajustes - Campo 11)
                    else if (debito.valorContribApurada !== undefined) {
                        const valor = parseValorMonetario(debito.valorContribApurada);
                        if (valor > 0) {
                            totalDebitos += valor;
                            console.log(`SPED-EXTRACTOR: Usando valorContribApurada de M210: ${valor.toFixed(2)}`);
                        }
                    } 
                    // 3. Cálculo manual: VL_BC_CONT_AJUS × ALIQ_PIS ÷ 100 (Campos 7 e 8)
                    else if (debito.valorBaseCalculoAjustada !== undefined && debito.aliqPis !== undefined) {
                        const baseAjustada = parseValorMonetario(debito.valorBaseCalculoAjustada);
                        const aliquota = parseFloat(debito.aliqPis);

                        if (baseAjustada > 0 && aliquota > 0) {
                            const valorCalculado = baseAjustada * (aliquota / 100);
                            totalDebitos += valorCalculado;
                            console.log(`SPED-EXTRACTOR: Calculando manualmente: Base ${baseAjustada.toFixed(2)} × Alíquota ${aliquota}% = ${valorCalculado.toFixed(2)}`);
                        }
                    }
                });

                if (totalDebitos > 0) {
                    console.log('SPED-EXTRACTOR: Débitos PIS extraídos do SPED (novo layout):', totalDebitos.toFixed(2));

                    // Armazenar resultados das validações técnicas
                    if (dadosSped.validacoesTecnicas) {
                        dadosSped.validacoesTecnicas.baseCalculoAjustada = dadosSped.validacoesTecnicas.baseCalculoAjustada || {};
                        dadosSped.validacoesTecnicas.baseCalculoAjustada.pis = validacaoBase;

                        dadosSped.validacoesTecnicas.contribuicaoFinal = dadosSped.validacoesTecnicas.contribuicaoFinal || {};
                        dadosSped.validacoesTecnicas.contribuicaoFinal.pis = validacaoContribuicao;

                        dadosSped.validacoesTecnicas.ajustesDetalhados = dadosSped.validacoesTecnicas.ajustesDetalhados || {};
                        dadosSped.validacoesTecnicas.ajustesDetalhados.pis = validacaoAjustes;
                    }

                    return totalDebitos;
                }
            }

            // Se não encontrou M210 ou o cálculo resultou zero, tenta o formato antigo
            let totalDebitos = 0;
            dadosSped.debitos.pis.forEach(debito => {
                // Prioritize valorContribuicaoApurada as per parser corrections
                let valor = 0;
                if (debito.valorContribuicaoApurada !== undefined) {
                    valor = parseValorMonetario(debito.valorContribuicaoApurada);
                } else if (debito.valorTotalContribuicao !== undefined) {
                    valor = parseValorMonetario(debito.valorTotalContribuicao);
                } else if (debito.valorContribucaoAPagar !== undefined) {
                    valor = parseValorMonetario(debito.valorContribucaoAPagar);
                } else if (debito.valorTotalDebitos !== undefined) {
                    valor = parseValorMonetario(debito.valorTotalDebitos);
                }

                // Validar o valor
                if (valor > 0 && valor < 1000000000) { // Entre 0 e 1 bilhão
                    totalDebitos += valor;
                    console.log(`SPED-EXTRACTOR: Registro débito PIS formato antigo com valor: ${valor.toFixed(2)}`);
                }
            });

            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos PIS extraídos do SPED (formato antigo):', totalDebitos.toFixed(2));
                return totalDebitos;
            }
        }

        // PRIORIDADE 2: Estimativa baseada no regime e faturamento
        if (faturamentoMensal > 0) {
            const regime = determinarRegimeTributario(dadosSped);
            const regimePisCofins = determinarRegimePisCofins(dadosSped);

            let aliquotaPIS = 0;
            if (regime === 'simples') {
                return 0; // PIS incluído na alíquota única do Simples
            } else if (regimePisCofins === 'nao-cumulativo') {
                aliquotaPIS = 0.0165; // 1,65%
            } else {
                aliquotaPIS = 0.0065; // 0,65%
            }

            const debitoEstimado = faturamentoMensal * aliquotaPIS;
            console.log(`SPED-EXTRACTOR: Débito PIS estimado - Regime: ${regimePisCofins}, Alíquota: ${aliquotaPIS * 100}%, Valor: ${debitoEstimado.toFixed(2)}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de COFINS com suporte ao novo layout
     * @param {Object} dadosSped - Dados do SPED processados
     * @param {number} faturamentoMensal - Faturamento mensal para estimativa
     * @returns {number} - Valor total dos débitos de COFINS
     */
    function calcularDebitosCOFINS(dadosSped, faturamentoMensal) {
        console.log('SPED-EXTRACTOR: Calculando débitos COFINS');
        console.log('SPED-EXTRACTOR: Estrutura de débitos disponível:', 
            dadosSped.debitos ? Object.keys(dadosSped.debitos) : 'Nenhum');

        // Inicializar objetos para armazenar resultado das validações técnicas
        const validacaoBase = { valida: true, divergencia: 0, formula: '' };
        const validacaoContribuicao = { valida: true, divergencia: 0, formula: '' };
        const validacaoAjustes = { processado: false, registrosM615: 0, consistente: true };

        // PRIORIDADE 1: Dados diretos do SPED Contribuições - registro M610
        if (dadosSped.debitos?.cofins?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.debitos.cofins.length} registros de débitos COFINS`);

            // Debug dos primeiros registros
            const amostraDebitos = dadosSped.debitos.cofins.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de débitos COFINS:', JSON.stringify(amostraDebitos, null, 2));

            // Verificar se temos registros do tipo M610 (novo layout)
            const registrosM610 = dadosSped.debitos.cofins.filter(reg => reg.registro === 'M610');

            if (registrosM610.length > 0) {
                console.log(`SPED-EXTRACTOR: Encontrados ${registrosM610.length} registros M610 (novo layout)`);

                let totalDebitos = 0;
                registrosM610.forEach(debito => {
                    // VALIDAÇÃO TÉCNICA 1: Validar base de cálculo ajustada
                    // Fórmula: Campo 7 = Campo 4 + Campo 5 - Campo 6
                    const resultadoValidacaoBase = validarBaseCalculoAjustada(debito, 'COFINS');

                    // Atualizar validação apenas se encontrar problema
                    if (!resultadoValidacaoBase.valida) {
                        validacaoBase.valida = false;
                        validacaoBase.divergencia = resultadoValidacaoBase.divergencia;
                        validacaoBase.formula = resultadoValidacaoBase.formula;
                    }

                    // VALIDAÇÃO TÉCNICA 2: Validar contribuição final
                    // Fórmula: Campo 16 = Campo 11 + Campo 12 - Campo 13 - Campo 14 + Campo 15
                    const resultadoValidacaoContribuicao = validarContribuicaoFinal(debito, 'COFINS');

                    // Atualizar validação apenas se encontrar problema
                    if (!resultadoValidacaoContribuicao.valida) {
                        validacaoContribuicao.valida = false;
                        validacaoContribuicao.divergencia = resultadoValidacaoContribuicao.divergencia;
                        validacaoContribuicao.formula = resultadoValidacaoContribuicao.formula;
                    }

                    // PROCESSAMENTO M615: Verificar e processar registros M615 relacionados
                    if (dadosSped.ajustesBaseCalculo?.cofins) {
                        const registrosM615 = dadosSped.ajustesBaseCalculo.cofins;
                        validacaoAjustes.processado = true;
                        validacaoAjustes.registrosM615 = registrosM615.length;

                        // Processar detalhamento dos ajustes
                        const resultadoM615 = processarRegistrosM615(registrosM615, debito);
                        validacaoAjustes.consistente = resultadoM615.consistente;

                        // Se houver inconsistência entre M615 e M610, registrar alerta
                        if (!resultadoM615.consistente) {
                            console.warn('SPED-EXTRACTOR: Inconsistência entre M610 e M615 - usando valores do registro M610');
                        }
                    }

                    // HIERARQUIA DE PRIORIDADE conforme documento técnico:
                    // 1. Campo VL_CONT_PER (valor final do período - Campo 16)
                    if (debito.valorContribPeriodo !== undefined) {
                        const valor = parseValorMonetario(debito.valorContribPeriodo);
                        if (valor > 0) {
                            totalDebitos += valor;
                            console.log(`SPED-EXTRACTOR: Usando valorContribPeriodo de M610: ${valor.toFixed(2)}`);
                        }
                    }
                    // 2. Campo VL_CONT_APUR (contribuição apurada antes ajustes - Campo 11)
                    else if (debito.valorContribApurada !== undefined) {
                        const valor = parseValorMonetario(debito.valorContribApurada);
                        if (valor > 0) {
                            totalDebitos += valor;
                            console.log(`SPED-EXTRACTOR: Usando valorContribApurada de M610: ${valor.toFixed(2)}`);
                        }
                    } 
                    // 3. Cálculo manual: VL_BC_CONT_AJUS × ALIQ_COFINS ÷ 100 (Campos 7 e 8)
                    else if (debito.valorBaseCalculoAjustada !== undefined && debito.aliqCofins !== undefined) {
                        const baseAjustada = parseValorMonetario(debito.valorBaseCalculoAjustada);
                        const aliquota = parseFloat(debito.aliqCofins);

                        if (baseAjustada > 0 && aliquota > 0) {
                            const valorCalculado = baseAjustada * (aliquota / 100);
                            totalDebitos += valorCalculado;
                            console.log(`SPED-EXTRACTOR: Calculando manualmente: Base ${baseAjustada.toFixed(2)} × Alíquota ${aliquota}% = ${valorCalculado.toFixed(2)}`);
                        }
                    }
                });

                if (totalDebitos > 0) {
                    console.log('SPED-EXTRACTOR: Débitos COFINS extraídos do SPED (novo layout):', totalDebitos.toFixed(2));

                    // Armazenar resultados das validações técnicas
                    if (dadosSped.validacoesTecnicas) {
                        dadosSped.validacoesTecnicas.baseCalculoAjustada = dadosSped.validacoesTecnicas.baseCalculoAjustada || {};
                        dadosSped.validacoesTecnicas.baseCalculoAjustada.cofins = validacaoBase;

                        dadosSped.validacoesTecnicas.contribuicaoFinal = dadosSped.validacoesTecnicas.contribuicaoFinal || {};
                        dadosSped.validacoesTecnicas.contribuicaoFinal.cofins = validacaoContribuicao;

                        dadosSped.validacoesTecnicas.ajustesDetalhados = dadosSped.validacoesTecnicas.ajustesDetalhados || {};
                        dadosSped.validacoesTecnicas.ajustesDetalhados.cofins = validacaoAjustes;
                    }

                    return totalDebitos;
                }
            }

            // Se não encontrou M610 ou o cálculo resultou zero, tenta o formato antigo
            let totalDebitos = 0;
            dadosSped.debitos.cofins.forEach(debito => {
                // Tenta vários campos possíveis
                let valor = 0;
                if (debito.valorContribuicaoApurada !== undefined) {
                    valor = parseValorMonetario(debito.valorContribuicaoApurada);
                } else if (debito.valorTotalContribuicao !== undefined) {
                    valor = parseValorMonetario(debito.valorTotalContribuicao);
                } else if (debito.valorContribucaoAPagar !== undefined) {
                    valor = parseValorMonetario(debito.valorContribucaoAPagar);
                } else if (debito.valorTotalDebitos !== undefined) {
                    valor = parseValorMonetario(debito.valorTotalDebitos);
                }

                // Validar o valor
                if (valor > 0 && valor < 1000000000) { // Entre 0 e 1 bilhão
                    totalDebitos += valor;
                    console.log(`SPED-EXTRACTOR: Registro débito COFINS formato antigo com valor: ${valor.toFixed(2)}`);
                }
            });

            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos COFINS extraídos do SPED (formato antigo):', totalDebitos.toFixed(2));
                return totalDebitos;
            }
        }

        // PRIORIDADE 2: Estimativa baseada no regime e faturamento
        if (faturamentoMensal > 0) {
            const regime = determinarRegimeTributario(dadosSped);
            const regimePisCofins = determinarRegimePisCofins(dadosSped);

            let aliquotaCOFINS = 0;
            if (regime === 'simples') {
                return 0; // COFINS incluído na alíquota única do Simples
            } else if (regimePisCofins === 'nao-cumulativo') {
                aliquotaCOFINS = 0.076; // 7,6%
            } else {
                aliquotaCOFINS = 0.03; // 3%
            }

            const debitoEstimado = faturamentoMensal * aliquotaCOFINS;
            console.log(`SPED-EXTRACTOR: Débito COFINS estimado - Regime: ${regimePisCofins}, Alíquota: ${aliquotaCOFINS * 100}%, Valor: ${debitoEstimado.toFixed(2)}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de ICMS com suporte a ajustes
     * MODIFICADA: Agora aplica corretamente os ajustes dos campos 4 e 5 do registro E110
     */
    function calcularDebitosICMS(dadosSped, faturamentoMensal) {
        console.log('SPED-EXTRACTOR: Calculando débitos ICMS');
        console.log('SPED-EXTRACTOR: Estrutura de débitos disponível:', dadosSped.debitos ? Object.keys(dadosSped.debitos) : 'Nenhum');

        // PRIORIDADE 1: Dados diretos do SPED Fiscal - registro E110 campo 2
        if (dadosSped.debitos?.icms?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.debitos.icms.length} registros de débitos ICMS`);

            // Debug dos primeiros registros
            const amostraDebitos = dadosSped.debitos.icms.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de débitos ICMS:', JSON.stringify(amostraDebitos, null, 2));

            const totalDebitos = dadosSped.debitos.icms.reduce((total, debito) => {
                // CORRIGIDO: Aplicar ajustes dos campos 4 e 5 do registro E110
                // Fórmula: VL_TOT_DEBITOS + VL_AJ_DEBITOS - VL_AJ_CREDITOS
                const valorTotalDebitos = parseValorMonetario(debito.valorTotalDebitos || 0);
                const valorAjustesDebito = parseValorMonetario(debito.valorAjustesDebitos || 0);
                const valorAjustesCredito = parseValorMonetario(debito.valorAjustesCreditos || 0);

                // Aplicar a fórmula correta conforme documento técnico
                const valorDebito = valorTotalDebitos + valorAjustesDebito - valorAjustesCredito;

                console.log(`SPED-EXTRACTOR: Registro débito ICMS calculado: ${valorTotalDebitos} + ${valorAjustesDebito} - ${valorAjustesCredito} = ${valorDebito}`);

                // Registrar ajustes nas validações técnicas
                if (dadosSped.validacoesTecnicas?.ajustesIcmsIpi?.icms) {
                    dadosSped.validacoesTecnicas.ajustesIcmsIpi.icms = {
                        ajustesAplicados: true,
                        valorAjustesDebito: valorAjustesDebito,
                        valorAjustesCredito: valorAjustesCredito
                    };
                }

                return total + valorDebito;
            }, 0);

            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos ICMS extraídos do SPED:', totalDebitos);
                return totalDebitos;
            } else {
                console.log('SPED-EXTRACTOR: Registros de débitos ICMS encontrados, mas valor total é zero');
            }
        } else {
            console.log('SPED-EXTRACTOR: Nenhum registro de débito ICMS encontrado');
        }

        // PRIORIDADE 2: Verificar registros E110 diretamente
        if (dadosSped.registros?.filter(r => r.startsWith('|E110|')).length > 0) {
            const registrosE110 = dadosSped.registros.filter(r => r.startsWith('|E110|'));
            let valorDebito = 0;

            registrosE110.forEach(registro => {
                const campos = registro.split('|');
                // Campo 2 = Valor Total dos Débitos (VL_TOT_DEBITOS)
                // Campo 4 = Valor de Ajustes dos Débitos (VL_AJ_DEBITOS)
                // Campo 5 = Valor de Ajustes dos Créditos (VL_AJ_CREDITOS)
                if (campos.length > 5) {
                    const valorTotalDebitos = parseFloat(campos[2]?.replace(',', '.') || 0);
                    const valorAjustesDebito = parseFloat(campos[4]?.replace(',', '.') || 0);
                    const valorAjustesCredito = parseFloat(campos[5]?.replace(',', '.') || 0);
                    
                    // Aplicar a fórmula correta conforme documento técnico
                    const valorDebitoRegistro = valorTotalDebitos + valorAjustesDebito - valorAjustesCredito;
                    valorDebito += valorDebitoRegistro;
                    
                    console.log(`SPED-EXTRACTOR: E110 processado: ${valorTotalDebitos} + ${valorAjustesDebito} - ${valorAjustesCredito} = ${valorDebitoRegistro}`);
                }
            });

            if (valorDebito > 0) {
                console.log(`SPED-EXTRACTOR: Débito ICMS extraído diretamente dos registros E110: ${valorDebito}`);
                return valorDebito;
            }
        }

        // PRIORIDADE 3: Estimativa para empresas comerciais/industriais
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'servicos' && faturamentoMensal > 0) {
            let aliquotaMedia = 0.18; // 18% como média

            // Ajuste da alíquota com base na UF da empresa
            if (dadosSped.empresa?.uf) {
                const uf = dadosSped.empresa.uf.toUpperCase();
                const aliquotasPorUf = obterAliquotaMediaEstado(uf);
                aliquotaMedia = aliquotasPorUf;
                console.log(`SPED-EXTRACTOR: Ajustando alíquota ICMS para UF ${uf}: ${aliquotaMedia * 100}%`);
            }

            const baseCalculoPercentual = 0.6; // 60% do faturamento sujeito ao ICMS

            const debitoEstimado = faturamentoMensal * baseCalculoPercentual * aliquotaMedia;
            console.log(`SPED-EXTRACTOR: Débito ICMS estimado - Tipo: ${tipoEmpresa}, Alíquota: ${aliquotaMedia * 100}%, Valor: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de IPI com processamento correto de ajustes
     * MODIFICADA: Agora processa corretamente os registros E210 e E220 para ajustes
     */
    function calcularDebitosIPI(dadosSped, faturamentoMensal) {
        console.log('SPED-EXTRACTOR: Calculando débitos IPI');

        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'industria') {
            console.log('SPED-EXTRACTOR: Tipo de empresa não é indústria, débito IPI = 0');
            return 0; // IPI só se aplica à indústria
        }

        // PRIORIDADE 1: Dados diretos do SPED Fiscal - registro E200 campo 2
        if (dadosSped.debitos?.ipi?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.debitos.ipi.length} registros de débitos IPI`);

            // Debug dos primeiros registros
            const amostraIpi = dadosSped.debitos.ipi.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de registros IPI:', JSON.stringify(amostraIpi, null, 2));

            let totalDebitos = 0;

            dadosSped.debitos.ipi.forEach(debito => {
                // Obter valor total dos débitos (campo 2 do E200)
                const valorTotalDebitos = parseValorMonetario(debito.valorTotalDebitos || 0);

                // Buscar registros de ajuste relacionados (E210 para débitos, E220 para créditos)
                let valorAjustesDebito = 0;
                let valorAjustesCredito = 0;

                // Verificar se existem ajustes de débito (E210)
                if (dadosSped.ajustes?.ipi_debito) {
                    valorAjustesDebito = dadosSped.ajustes.ipi_debito.reduce((total, ajuste) => 
                        total + parseValorMonetario(ajuste.valorAjuste || 0), 0);

                    console.log(`SPED-EXTRACTOR: Ajustes IPI débito encontrados: ${valorAjustesDebito.toFixed(2)}`);
                }

                // Verificar se existem ajustes de crédito (E220)
                if (dadosSped.ajustes?.ipi_credito) {
                    valorAjustesCredito = dadosSped.ajustes.ipi_credito.reduce((total, ajuste) => 
                        total + parseValorMonetario(ajuste.valorAjuste || 0), 0);

                    console.log(`SPED-EXTRACTOR: Ajustes IPI crédito encontrados: ${valorAjustesCredito.toFixed(2)}`);
                }

                // Aplicar a fórmula correta conforme documento técnico
                // VL_TOT_DEBITOS + VL_AJ_DEBITOS(E210) - VL_AJ_CREDITOS(E220)
                const valorDebitoAjustado = valorTotalDebitos + valorAjustesDebito - valorAjustesCredito;

                console.log(`SPED-EXTRACTOR: Débito IPI ajustado: ${valorTotalDebitos} + ${valorAjustesDebito} - ${valorAjustesCredito} = ${valorDebitoAjustado}`);

                // Registrar ajustes nas validações técnicas
                if (dadosSped.validacoesTecnicas?.ajustesIcmsIpi?.ipi) {
                    dadosSped.validacoesTecnicas.ajustesIcmsIpi.ipi = {
                        ajustesAplicados: true,
                        registrosE210: dadosSped.ajustes?.ipi_debito?.length || 0,
                        registrosE220: dadosSped.ajustes?.ipi_credito?.length || 0
                    };
                }

                totalDebitos += valorDebitoAjustado;
            });

            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos IPI extraídos do SPED:', totalDebitos);
                return totalDebitos;
            } else {
                console.log('SPED-EXTRACTOR: Registros de IPI encontrados, mas valor total de débitos é zero');
            }
        }

        // PRIORIDADE 2: Verificar registros E200, E210 e E220 diretamente
        if (dadosSped.registros?.filter(r => r.startsWith('|E200|')).length > 0) {
            const registrosE200 = dadosSped.registros.filter(r => r.startsWith('|E200|'));
            const registrosE210 = dadosSped.registros?.filter(r => r.startsWith('|E210|')) || [];
            const registrosE220 = dadosSped.registros?.filter(r => r.startsWith('|E220|')) || [];
            
            let valorDebito = 0;

            registrosE200.forEach(registro => {
                const campos = registro.split('|');
                // Campo 2 = Valor Total dos Débitos (VL_TOT_DEBITOS)
                const valorTotalDebitos = parseFloat(campos[2]?.replace(',', '.') || 0);
                
                // Buscar ajustes relacionados a este período
                let valorAjustesDebito = 0;
                let valorAjustesCredito = 0;
                
                // Processar registros E210 (ajustes débitos)
                if (registrosE210.length > 0) {
                    valorAjustesDebito = registrosE210.reduce((total, ajuste) => {
                        const camposAjuste = ajuste.split('|');
                        // Campo 3 = Valor do Ajuste (VL_AJ_DEBITOS)
                        const valorAjuste = parseFloat(camposAjuste[3]?.replace(',', '.') || 0);
                        return total + valorAjuste;
                    }, 0);
                }
                
                // Processar registros E220 (ajustes créditos)
                if (registrosE220.length > 0) {
                    valorAjustesCredito = registrosE220.reduce((total, ajuste) => {
                        const camposAjuste = ajuste.split('|');
                        // Campo 3 = Valor do Ajuste (VL_AJ_CREDITOS)
                        const valorAjuste = parseFloat(camposAjuste[3]?.replace(',', '.') || 0);
                        return total + valorAjuste;
                    }, 0);
                }
                
                // Aplicar a fórmula correta: VL_TOT_DEBITOS + VL_AJ_DEBITOS - VL_AJ_CREDITOS
                const valorDebitoRegistro = valorTotalDebitos + valorAjustesDebito - valorAjustesCredito;
                valorDebito += valorDebitoRegistro;
                
                console.log(`SPED-EXTRACTOR: E200/E210/E220 processados: ${valorTotalDebitos} + ${valorAjustesDebito} - ${valorAjustesCredito} = ${valorDebitoRegistro}`);
            });

            if (valorDebito > 0) {
                console.log(`SPED-EXTRACTOR: Débito IPI extraído diretamente dos registros E200/E210/E220: ${valorDebito}`);
                return valorDebito;
            }
        }

        // PRIORIDADE 3: Estimativa baseada no faturamento
        if (faturamentoMensal > 0) {
            const aliquotaMedia = 0.10; // 10% como média
            const baseCalculoPercentual = 0.4; // 40% do faturamento sujeito ao IPI

            const debitoEstimado = faturamentoMensal * baseCalculoPercentual * aliquotaMedia;
            console.log(`SPED-EXTRACTOR: Débito IPI estimado - Valor: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de ISS
     */
    function calcularDebitosISS(dadosSped, faturamentoMensal) {
        console.log('SPED-EXTRACTOR: Calculando débitos ISS');

        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'servicos') {
            console.log('SPED-EXTRACTOR: Tipo de empresa não é serviços, débito ISS = 0');
            return 0; // ISS só se aplica a serviços
        }

        // ISS não consta no SPED, verificar se há alguma fonte alternativa
        if (dadosSped.impostos?.iss?.length > 0) {
            const totalIss = dadosSped.impostos.iss.reduce((total, registro) => 
                total + (registro.valorIss || registro.valorTotal || 0), 0);

            if (totalIss > 0) {
                console.log('SPED-EXTRACTOR: Valores de ISS encontrados em registros específicos:', totalIss);
                return totalIss;
            }
        }

        // Verificar se há registros A100 (serviços) no SPED Contribuições
        let baseCalculoServicos = 0;
        if (dadosSped.detalhamento?.receita_servico?.length > 0) {
            baseCalculoServicos = dadosSped.detalhamento.receita_servico.reduce((total, serv) => 
                total + (serv.valorOperacao || serv.valorServico || 0), 0);

            console.log('SPED-EXTRACTOR: Base de cálculo de serviços encontrada:', baseCalculoServicos);
        }

        // Estimativa por faturamento se não houver informação específica
        if (faturamentoMensal > 0) {
            // Utilizar base de cálculo específica de serviços se disponível
            const baseCalculo = baseCalculoServicos > 0 ? baseCalculoServicos : faturamentoMensal;

            // Tentar determinar a alíquota com base no município
            let aliquotaMedia = 0.05; // 5% como padrão

            // Ajustar alíquota para municípios conhecidos se disponível
            if (dadosSped.empresa?.codMunicipio) {
                const codMunicipio = dadosSped.empresa.codMunicipio;
                // Alguns exemplos de alíquotas municipais
                const aliquotasPorMunicipio = {
                    '3550308': 0.05, // São Paulo-SP
                    '3304557': 0.05, // Rio de Janeiro-RJ
                    '5300108': 0.05, // Brasília-DF
                    '2611606': 0.05, // Recife-PE
                    '4106902': 0.05  // Curitiba-PR
                    // Adicionar outros conforme necessário
                };

                if (aliquotasPorMunicipio[codMunicipio]) {
                    aliquotaMedia = aliquotasPorMunicipio[codMunicipio];
                    console.log(`SPED-EXTRACTOR: Ajustando alíquota ISS para município ${codMunicipio}: ${aliquotaMedia * 100}%`);
                }
            }

            const debitoEstimado = baseCalculo * aliquotaMedia;
            console.log(`SPED-EXTRACTOR: Débito ISS estimado - Base: ${baseCalculo}, Alíquota: ${aliquotaMedia * 100}%, Valor: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula créditos de PIS com dados do SPED
     * @param {Object} dadosSped - Dados do SPED processados
     * @returns {number} - Valor total dos créditos de PIS
     */
    function calcularCreditosPIS(dadosSped) {
        console.log('SPED-EXTRACTOR: Calculando créditos PIS');
        console.log('SPED-EXTRACTOR: Estrutura de créditos disponível:', dadosSped.creditos ? Object.keys(dadosSped.creditos) : 'Nenhum');

        let totalCreditos = 0;
        let fonteCredito = 'não identificada';

        // PRIORIDADE 1: Registros M100 do SPED Contribuições 
        if (dadosSped.creditos?.pis?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.creditos.pis.length} registros de créditos PIS`);

            // Debug dos primeiros registros
            const amostraCreditos = dadosSped.creditos.pis.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de créditos PIS:', JSON.stringify(amostraCreditos, null, 2));

            // Somar todos os créditos válidos
            totalCreditos = dadosSped.creditos.pis.reduce((total, credito) => {
                let valorCredito = 0;

                // Tentar diferentes campos possíveis para valor do crédito
                if (credito.valorCredito !== undefined) {
                    valorCredito = parseValorMonetario(credito.valorCredito);
                } else if (credito.valorCreditoDisp !== undefined) {
                    valorCredito = parseValorMonetario(credito.valorCreditoDisp);
                } else if (credito.valorTotalCreditos !== undefined) {
                    valorCredito = parseValorMonetario(credito.valorTotalCreditos);
                }

                // Validar o valor
                if (valorCredito > 0 && valorCredito < 1000000000) { // Entre 0 e 1 bilhão
                    console.log(`SPED-EXTRACTOR: Registro crédito PIS com valor: ${valorCredito.toFixed(2)}`);
                    return total + valorCredito;
                }
                return total;
            }, 0);

            if (totalCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos PIS extraídos do SPED:', totalCreditos.toFixed(2));
                fonteCredito = 'M100/M105';
                return totalCreditos;
            }
        }

        // PRIORIDADE 2: Registros M200 - campo VL_TOT_CRED_DESC
        if (dadosSped.debitos?.pis?.length > 0) {
            const registrosM200 = dadosSped.debitos.pis.filter(reg => reg.registro === 'M200');

            if (registrosM200.length > 0) {
                console.log(`SPED-EXTRACTOR: Encontrados ${registrosM200.length} registros M200 para créditos PIS`);

                totalCreditos = registrosM200.reduce((total, registro) => {
                    let valorCredito = 0;

                    if (registro.valorTotalCreditos !== undefined) {
                        valorCredito = parseValorMonetario(registro.valorTotalCreditos);
                    }

                    if (valorCredito > 0) {
                        console.log(`SPED-EXTRACTOR: Crédito PIS do registro M200: ${valorCredito.toFixed(2)}`);
                        return total + valorCredito;
                    }
                    return total;
                }, 0);

                if (totalCreditos > 0) {
                    console.log('SPED-EXTRACTOR: Créditos PIS extraídos do registro M200:', totalCreditos.toFixed(2));
                    fonteCredito = 'M200';
                    return totalCreditos;
                }
            }
        }

        // PRIORIDADE 3: Estimativa baseada no regime não-cumulativo
        const regimePisCofins = determinarRegimePisCofins(dadosSped);
        if (regimePisCofins === 'nao-cumulativo') {
            // Tentar estimar com base no faturamento
            const faturamentoMensal = calcularFaturamentoMensal(dadosSped.documentos || []);

            if (faturamentoMensal > 0) {
                const baseCalculoEstimada = faturamentoMensal * 0.6; // 60% do faturamento
                const aliquotaPIS = 0.0165; // 1,65%
                const aproveitamentoEstimado = 0.8; // 80%

                const creditoEstimado = baseCalculoEstimada * aliquotaPIS * aproveitamentoEstimado;
                console.log(`SPED-EXTRACTOR: Crédito PIS estimado - Regime: ${regimePisCofins}, Base: ${baseCalculoEstimada.toFixed(2)}, Valor: ${creditoEstimado.toFixed(2)}`);
                fonteCredito = 'estimativa';
                return creditoEstimado;
            }
        } else {
            console.log(`SPED-EXTRACTOR: Regime PIS/COFINS é ${regimePisCofins}, não gera créditos ou gera créditos reduzidos`);
        }

        console.log(`SPED-EXTRACTOR: Não foi possível identificar créditos PIS. Fonte tentada: ${fonteCredito}`);
        return 0;
    }

    /**
     * Calcula créditos de COFINS com suporte aprimorado para registros M505
     * @param {Object} dadosSped - Dados do SPED processados
     * @returns {number} - Valor total dos créditos de COFINS
     */
    function calcularCreditosCOFINS(dadosSped) {
        console.log('SPED-EXTRACTOR: Calculando créditos COFINS');
        console.log('SPED-EXTRACTOR: Estrutura de créditos disponível:', dadosSped.creditos ? Object.keys(dadosSped.creditos) : 'Nenhum');

        let totalCreditos = 0;
        let fonteCredito = 'não identificada';

        // PRIORIDADE 1: Registros M500 do SPED Contribuições
        if (dadosSped.creditos?.cofins?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.creditos.cofins.length} registros de créditos COFINS`);

            // Debug dos primeiros registros
            const amostraCreditos = dadosSped.creditos.cofins.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de créditos COFINS:', JSON.stringify(amostraCreditos, null, 2));

            // Somar todos os créditos válidos
            totalCreditos = dadosSped.creditos.cofins.reduce((total, credito) => {
                let valorCredito = 0;

                // Tentar diferentes campos possíveis para valor do crédito
                if (credito.valorCredito !== undefined) {
                    valorCredito = parseValorMonetario(credito.valorCredito);
                } else if (credito.valorCreditoDisp !== undefined) {
                    valorCredito = parseValorMonetario(credito.valorCreditoDisp);
                } else if (credito.valorTotalCreditos !== undefined) {
                    valorCredito = parseValorMonetario(credito.valorTotalCreditos);
                }

                // Validar o valor
                if (valorCredito > 0 && valorCredito < 1000000000) { // Entre 0 e 1 bilhão
                    console.log(`SPED-EXTRACTOR: Registro crédito COFINS com valor: ${valorCredito.toFixed(2)}`);
                    return total + valorCredito;
                }
                return total;
            }, 0);

            if (totalCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos COFINS extraídos do SPED:', totalCreditos.toFixed(2));
                fonteCredito = 'M500/M505';
                return totalCreditos;
            }
        }

        // PRIORIDADE 2: Registros M600 - campo VL_TOT_CRED_DESC
        if (dadosSped.debitos?.cofins?.length > 0) {
            const registrosM600 = dadosSped.debitos.cofins.filter(reg => reg.registro === 'M600');

            if (registrosM600.length > 0) {
                console.log(`SPED-EXTRACTOR: Encontrados ${registrosM600.length} registros M600 para créditos COFINS`);

                totalCreditos = registrosM600.reduce((total, registro) => {
                    let valorCredito = 0;

                    if (registro.valorTotalCreditos !== undefined) {
                        valorCredito = parseValorMonetario(registro.valorTotalCreditos);
                    }

                    if (valorCredito > 0) {
                        console.log(`SPED-EXTRACTOR: Crédito COFINS do registro M600: ${valorCredito.toFixed(2)}`);
                        return total + valorCredito;
                    }
                    return total;
                }, 0);

                if (totalCreditos > 0) {
                    console.log('SPED-EXTRACTOR: Créditos COFINS extraídos do registro M600:', totalCreditos.toFixed(2));
                    fonteCredito = 'M600';
                    return totalCreditos;
                }
            }
        }

        // PRIORIDADE 3: Estimativa baseada no regime não-cumulativo
        const regimePisCofins = determinarRegimePisCofins(dadosSped);
        if (regimePisCofins === 'nao-cumulativo') {
            // Tentar estimar com base no faturamento
            const faturamentoMensal = calcularFaturamentoMensal(dadosSped.documentos || []);

            if (faturamentoMensal > 0) {
                const baseCalculoEstimada = faturamentoMensal * 0.6; // 60% do faturamento
                const aliquotaCOFINS = 0.076; // 7,6%
                const aproveitamentoEstimado = 0.8; // 80%

                const creditoEstimado = baseCalculoEstimada * aliquotaCOFINS * aproveitamentoEstimado;
                console.log(`SPED-EXTRACTOR: Crédito COFINS estimado - Regime: ${regimePisCofins}, Base: ${baseCalculoEstimada.toFixed(2)}, Valor: ${creditoEstimado.toFixed(2)}`);
                fonteCredito = 'estimativa';
                return creditoEstimado;
            }
        } else {
            console.log(`SPED-EXTRACTOR: Regime PIS/COFINS é ${regimePisCofins}, não gera créditos ou gera créditos reduzidos`);
        }

        console.log(`SPED-EXTRACTOR: Não foi possível identificar créditos COFINS. Fonte tentada: ${fonteCredito}`);
        return 0;
    }

    /**
     * Valida a consistência entre os ajustes de base de cálculo no M210/M610 e seus registros filhos M215/M615
     * @param {Object} dadosConsolidados - Dados da contribuição (M210 ou M610)
     * @param {Array} dadosAjustes - Registros de ajuste (M215 ou M615)
     * @param {string} tipoTributo - 'pis' ou 'cofins'
     * @returns {boolean} - Verdadeiro se consistente
     */
    function validarConsistenciaAjustesBC(dadosConsolidados, dadosAjustes, tipoTributo) {
        if (!dadosConsolidados || !dadosAjustes || dadosAjustes.length === 0) {
            console.log(`SPED-EXTRACTOR: Sem dados de ajustes para validar (${tipoTributo})`);
            return true;
        }

        // Somar ajustes de acréscimo dos registros filhos
        const totalAcrescimo = dadosAjustes
            .filter(item => item.indAjusteBc === '0' || item.tipoAjuste === 'acrescimo')
            .reduce((total, item) => {
                const valor = item.valorAjusteBc || item.valorAjuste || 0;
                return total + parseValorMonetario(valor);
            }, 0);

        // Somar ajustes de redução dos registros filhos
        const totalReducao = dadosAjustes
            .filter(item => item.indAjusteBc === '1' || item.tipoAjuste === 'reducao')
            .reduce((total, item) => {
                const valor = item.valorAjusteBc || item.valorAjuste || 0;
                return total + parseValorMonetario(valor);
            }, 0);

        // Obter valores do registro M210/M610
        const acrescimoPai = parseValorMonetario(dadosConsolidados.valorAjustesAcrescimoBc || 0);
        const reducaoPai = parseValorMonetario(dadosConsolidados.valorAjustesReducaoBc || 0);

        // Validar consistência (com tolerância de 0.01 para arredondamentos)
        const consisteAcrescimo = Math.abs(totalAcrescimo - acrescimoPai) < 0.01;
        const consisteReducao = Math.abs(totalReducao - reducaoPai) < 0.01;

        if (!consisteAcrescimo || !consisteReducao) {
            console.warn(`SPED-EXTRACTOR: Inconsistência detectada em ajustes BC de ${tipoTributo}:`, {
                valorAcrescimoPai: acrescimoPai.toFixed(2),
                totalAcrescimoFilhos: totalAcrescimo.toFixed(2),
                valorReducaoPai: reducaoPai.toFixed(2),
                totalReducaoFilhos: totalReducao.toFixed(2)
            });

            // Mesmo com inconsistência, retornamos true para continuar o processamento
            return true;
        }

        console.log(`SPED-EXTRACTOR: Ajustes BC de ${tipoTributo} validados com sucesso:`, {
            acrescimos: acrescimoPai.toFixed(2),
            reducoes: reducaoPai.toFixed(2)
        });

        return true;
    }    
        
    /**
 * Calcula créditos de ICMS com suporte aprimorado para registros E110
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {number} - Valor total dos créditos de ICMS
 */
function calcularCreditosICMS(dadosSped) {
    console.log('SPED-EXTRACTOR: Calculando créditos ICMS');

    // Inicializar variáveis de controle
    let totalCreditos = 0;
    let fonteCredito = 'não identificada';

    // PRIORIDADE 1: Extrair diretamente do registro E110 (campo 6)
    if (dadosSped.debitos?.icms?.length > 0) {
        const registrosE110 = dadosSped.debitos.icms.filter(reg => reg.registro === 'E110');
        console.log(`SPED-EXTRACTOR: Encontrados ${registrosE110.length} registros E110 para créditos ICMS`);

        if (registrosE110.length > 0) {
            totalCreditos = registrosE110.reduce((sum, registro) => {
                // Campo 6: VL_TOT_CREDITOS
                const valorCredito = registro.valorTotalCreditos || 0;
                if (valorCredito > 0) {
                    console.log(`SPED-EXTRACTOR: Crédito ICMS do registro E110: ${valorCredito.toFixed(2)}`);
                }
                return sum + valorCredito;
            }, 0);

            if (totalCreditos > 0) {
                console.log(`SPED-EXTRACTOR: Créditos ICMS obtidos do registro E110: ${totalCreditos.toFixed(2)}`);
                fonteCredito = 'E110';
                return totalCreditos;
            }
        }
    }

    // PRIORIDADE 2: Processamento direto dos registros E110
    if (dadosSped.registros?.filter(r => r.startsWith('|E110|')).length > 0) {
        const registrosE110 = dadosSped.registros.filter(r => r.startsWith('|E110|'));
        console.log(`SPED-EXTRACTOR: Encontrados ${registrosE110.length} registros E110 diretos`);

        let creditos = 0;
        registrosE110.forEach(registro => {
            const campos = registro.split('|');
            // Campo 6 = Valor Total dos Créditos (VL_TOT_CREDITOS)
            if (campos.length > 6) {
                const valorCredito = parseFloat(campos[6]?.replace(',', '.') || 0);
                if (valorCredito > 0 && valorCredito < 100000000) { // Validação de valor razoável
                    creditos += valorCredito;
                    console.log(`SPED-EXTRACTOR: Registro E110 processado: ${valorCredito.toFixed(2)}`);
                }
            }
        });

        if (creditos > 0) {
            console.log(`SPED-EXTRACTOR: Créditos ICMS obtidos de registros E110 diretos: ${creditos.toFixed(2)}`);
            totalCreditos = creditos;
            fonteCredito = 'E110 direto';
            return totalCreditos;
        }
    }

    // PRIORIDADE 3: Estimativa baseada no regime tributário e tipo de empresa
    const tipoEmpresa = determinarTipoEmpresa(dadosSped);
    const faturamentoMensal = calcularFaturamentoMensal(dadosSped.documentos || []);

    if (tipoEmpresa !== 'servicos' && faturamentoMensal > 0) {
        // Parâmetros de estimativa ajustados com base em dados setoriais
        let baseCalculoCompras = 0;
        let aproveitamentoICMS = 0;

        if (tipoEmpresa === 'industria') {
            baseCalculoCompras = faturamentoMensal * 0.72; // 72% do faturamento em compras
            aproveitamentoICMS = 0.88; // 88% de aproveitamento típico
        } else { // comercio
            baseCalculoCompras = faturamentoMensal * 0.78; // 78% do faturamento em compras
            aproveitamentoICMS = 0.92; // 92% de aproveitamento típico
        }

        // Obter alíquota média do estado
        const aliquotaMedia = obterAliquotaMediaEstado(dadosSped.empresa?.uf || 'SP');

        const creditoEstimado = baseCalculoCompras * aliquotaMedia * aproveitamentoICMS;
        console.log(`SPED-EXTRACTOR: Crédito ICMS estimado - Tipo: ${tipoEmpresa}, Base: ${baseCalculoCompras.toFixed(2)}, Alíquota: ${(aliquotaMedia*100).toFixed(2)}%, Valor: ${creditoEstimado.toFixed(2)}`);

        totalCreditos = creditoEstimado;
        fonteCredito = 'estimativa';
        return totalCreditos;
    }

    // Se é empresa de serviços, normalmente não tem créditos significativos de ICMS
    if (tipoEmpresa === 'servicos') {
        console.log('SPED-EXTRACTOR: Empresa de serviços, créditos de ICMS tipicamente não aplicáveis');
        return 0;
    }

    console.log(`SPED-EXTRACTOR: Não foi possível identificar créditos ICMS. Fonte utilizada: ${fonteCredito}`);
    return totalCreditos;
}

/**
 * Obtém as operações agrupadas por CFOP
 * @param {Array} documentos - Documentos fiscais
 * @returns {Object} - Mapa de CFOP para valor total
 */
function obterOperacoesPorCFOP(documentos) {
    const cfopMap = {};

    if (!Array.isArray(documentos)) return cfopMap;

    documentos.forEach(doc => {
        if (!doc || !doc.cfop) return;

        const cfop = doc.cfop;
        const valor = doc.valorTotal || doc.valorOperacao || 0;

        if (valor > 0) {
            if (!cfopMap[cfop]) {
                cfopMap[cfop] = 0;
            }
            cfopMap[cfop] += valor;
        }
    });

    return cfopMap;
}

/**
 * Obtém a alíquota média de ICMS do estado
 * @param {string} uf - Sigla do estado
 * @returns {number} - Alíquota média em decimal
 */
function obterAliquotaMediaEstado(uf) {
    // Mapeamento de alíquotas médias por estado
    const aliquotasPorUf = {
        'AC': 0.19, // Acre - Mantido conforme [4][6]
        'AL': 0.20, // Alagoas - Aumento para 20% com FECOEP [6][9]
        'AP': 0.18, // Amapá - Mantido conforme [4][6]
        'AM': 0.20, // Amazonas - Mantido conforme [6][9]
        'BA': 0.205, // Bahia - Aumento para 20.5% [6][9][12]
        'CE': 0.20, // Ceará - Aumento para 20% [6][9]
        'DF': 0.20, // Distrito Federal - Aumento para 20% [6][9]
        'ES': 0.17, // Espírito Santo - Mantido [4][9]
        'GO': 0.19, // Goiás - Confirmado 19% desde 2024 [9]
        'MA': 0.23, // Maranhão - Majoração para 23% em 2025 [6][12][13]
        'MT': 0.17, // Mato Grosso - Mantido [4][6]
        'MS': 0.17, // Mato Grosso do Sul - Mantido [4][6]
        'MG': 0.18, // Minas Gerais - Mantido [4][6]
        'PA': 0.19, // Pará - Mantido [6][9]
        'PB': 0.20, // Paraíba - Aumento para 20% [6][9]
        'PR': 0.195, // Paraná - Ajuste para 19.5% [6][9]
        'PE': 0.205, // Pernambuco - Aumento para 20.5% [6][9]
        'PI': 0.225, // Piauí - Majoração para 22.5% [12][13]
        'RJ': 0.20, // Rio de Janeiro - Mantido com adicional FECP [6][9]
        'RN': 0.20, // Rio Grande do Norte - Aumento para 20% [12][13]
        'RS': 0.17, // Rio Grande do Sul - Mantido [4][6]
        'RO': 0.195, // Rondônia - Aumento para 19.5% [9]
        'RR': 0.20, // Roraima - Mantido [6]
        'SC': 0.17, // Santa Catarina - Mantido [4][6]
        'SP': 0.18, // São Paulo - Mantido [4][6]
        'SE': 0.20, // Sergipe - Aumento com FECOEP [6][13]
        'TO': 0.20  // Tocantins - Aumento para 20% [6][9]
    };

    // Converter para maiúsculas e obter alíquota ou usar padrão de 18%
    const ufUpper = (uf || '').toUpperCase();
    return aliquotasPorUf[ufUpper] || 0.18;
}

/**
 * Calcula créditos de IPI com processamento aprimorado para E220
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {number} - Valor total dos créditos de IPI
 */
function calcularCreditosIPI(dadosSped) {
    console.log('SPED-EXTRACTOR: Calculando créditos IPI');

    const tipoEmpresa = determinarTipoEmpresa(dadosSped);
    if (tipoEmpresa !== 'industria') {
        console.log('SPED-EXTRACTOR: Tipo de empresa não é indústria, crédito IPI = 0');
        return 0; // IPI só se aplica à indústria
    }

    // PRIORIDADE 1: Dados diretos do SPED Fiscal - registro E200 campo 3
    if (dadosSped.debitos?.ipi?.length > 0) {
        const registrosE200 = dadosSped.debitos.ipi.filter(reg => reg.registro === 'E200');
        console.log(`SPED-EXTRACTOR: Encontrados ${registrosE200.length} registros E200 para créditos IPI`);

        if (registrosE200.length > 0) {
            const totalCreditos = registrosE200.reduce((sum, registro) => {
                // Campo 3: VL_TOT_CREDITOS
                const valorCredito = registro.valorTotalCreditos || 0;
                if (valorCredito > 0) {
                    console.log(`SPED-EXTRACTOR: Crédito IPI do registro E200: ${valorCredito}`);
                }
                return sum + valorCredito;
            }, 0);

            if (totalCreditos > 0) {
                console.log(`SPED-EXTRACTOR: Créditos IPI extraídos do registro E200: ${totalCreditos}`);
                return totalCreditos;
            }
        }
    }

    // PRIORIDADE 2: Verificar registros E200 diretamente
    if (dadosSped.registros?.filter(r => r.startsWith('|E200|')).length > 0) {
        const registrosE200 = dadosSped.registros.filter(r => r.startsWith('|E200|'));
        let valorCredito = 0;

        registrosE200.forEach(registro => {
            const campos = registro.split('|');
            // Campo 3 = Valor Total dos Créditos (VL_TOT_CREDITOS)
            if (campos.length > 3) {
                valorCredito += parseFloat(campos[3]?.replace(',', '.') || 0);
            }
        });

        if (valorCredito > 0) {
            console.log(`SPED-EXTRACTOR: Crédito IPI extraído diretamente dos registros E200: ${valorCredito}`);
            return valorCredito;
        }
    }

    // PRIORIDADE 3: Verificar registros de créditos específicos
    if (dadosSped.creditos?.ipi?.length > 0) {
        const valorCreditos = dadosSped.creditos.ipi.reduce((total, cred) => 
            total + (cred.valorCredito || cred.valorTotalCreditos || 0), 0);

        if (valorCreditos > 0) {
            console.log('SPED-EXTRACTOR: Créditos IPI encontrados em registros específicos:', valorCreditos);
            return valorCreditos;
        }
    }

    // PRIORIDADE 4: Estimativa baseada no faturamento
    const faturamentoAnual = calcularFaturamentoMensal(dadosSped.documentos || []) * 12;

    if (faturamentoAnual > 0) {
        const aliquotaMediaIPI = 0.10; // 10%
        const baseCalculoCompras = faturamentoAnual * 0.4; // 40% para matérias-primas
        const aproveitamentoIPI = 0.90; // 90% de aproveitamento

        const creditoEstimado = (baseCalculoCompras * aliquotaMediaIPI * aproveitamentoIPI) / 12;
        console.log(`SPED-EXTRACTOR: Crédito IPI estimado - Base: ${baseCalculoCompras}, Valor: ${creditoEstimado}`);
        return creditoEstimado;
    }

    return 0;
}

/**
 * Determina o regime tributário
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {string} - Regime tributário identificado
 */
function determinarRegimeTributario(dadosSped) {
    // PRIORIDADE 1: Informação direta da ECF
    if (dadosSped.ecf?.parametros?.formaApuracao) {
        const forma = dadosSped.ecf.parametros.formaApuracao;
        if (['1', '2'].includes(forma)) return 'real';
        if (['3', '4'].includes(forma)) return 'presumido';
        if (['5', '6', '7'].includes(forma)) return 'simples';
    }

    // PRIORIDADE 2: Análise do regime PIS/COFINS
    if (dadosSped.regimes?.pis_cofins) {
        const codigo = dadosSped.regimes.pis_cofins.codigoIncidencia;
        if (codigo === '1') return 'real'; // Exclusivamente não-cumulativo
        if (codigo === '2') return 'presumido'; // Exclusivamente cumulativo
    }

    // PRIORIDADE 3: Verificação de registros específicos
    if (dadosSped.impostos?.simples?.length > 0) {
        return 'simples';
    }

    // PRIORIDADE 4: Análise de créditos PIS/COFINS
    const temCreditosPisCofins = (dadosSped.creditos?.pis?.length > 0 || 
                                 dadosSped.creditos?.cofins?.length > 0);
    
    if (temCreditosPisCofins) {
        return 'real'; // Empresas com créditos geralmente são do Lucro Real
    }

    return 'presumido'; // Padrão mais comum
}

/**
 * Determina o regime PIS/COFINS
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {string} - Regime PIS/COFINS identificado
 */
function determinarRegimePisCofins(dadosSped) {
    if (dadosSped.regimes?.pis_cofins) {
        const codigo = dadosSped.regimes.pis_cofins.codigoIncidencia;
        if (codigo === '1') return 'nao-cumulativo';
        if (codigo === '2') return 'cumulativo';
        if (codigo === '3') return 'nao-cumulativo'; // Misto, priorizamos não-cumulativo
    }

    // Inferir pelo registro 0110 do SPED Contribuições
    if (dadosSped.contribuicoes?.regimes?.pis_cofins?.codigoIncidencia) {
        const codigo = dadosSped.contribuicoes.regimes.pis_cofins.codigoIncidencia;
        if (codigo === '1') return 'nao-cumulativo';
        if (codigo === '2') return 'cumulativo';
        if (codigo === '3') return 'nao-cumulativo'; // Misto, priorizamos não-cumulativo
    }

    // Inferir pelo regime tributário
    const regime = determinarRegimeTributario(dadosSped);
    return regime === 'real' ? 'nao-cumulativo' : 'cumulativo';
}

/**
 * Determina o tipo de empresa
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {string} - Tipo de empresa identificado
 */
function determinarTipoEmpresa(dadosSped) {
    // Verificação direta de registros de IPI (forte indicativo de indústria)
    if (dadosSped.impostos?.ipi?.length > 0 || dadosSped.debitos?.ipi?.length > 0) {
        return 'industria';
    }

    // Análise dos CFOPs
    const cfops = extrairCFOPs(dadosSped);
    return analisarCFOPs(cfops);
}

/**
 * Determina o setor IVA da empresa baseado nos dados SPED
 * @param {Object} dadosEmpresa - Dados da empresa extraídos do SPED
 * @param {Object} dadosFiscais - Dados fiscais extraídos
 * @returns {Object} Configuração do setor IVA
 */
function determinarSetorIVA(dadosEmpresa, dadosFiscais) {
    // Configurações padrão do IVA
    const configuracaoPadrao = {
        codigoSetor: 'standard',
        categoriaIva: 'standard',
        cbs: 0.088, // 8,8% - alíquota padrão CBS
        ibs: 0.177, // 17,7% - alíquota padrão IBS
        reducaoEspecial: 0,
        fonteClassificacao: 'automatica'
    };

    try {
        // Se não há dados suficientes, retornar configuração padrão
        if (!dadosEmpresa || !dadosFiscais) {
            console.warn('SPED-EXTRACTOR: Dados insuficientes para determinação do setor IVA. Usando configuração padrão.');
            return configuracaoPadrao;
        }

        // Analisar CNAE principal se disponível
        if (dadosEmpresa.cnae) {
            const setorPorCnae = classificarSetorPorCnae(dadosEmpresa.cnae);
            if (setorPorCnae) {
                return {
                    ...configuracaoPadrao,
                    ...setorPorCnae,
                    codigoSetor: setorPorCnae.codigo,
                    fonteClassificacao: 'cnae'
                };
            }
        }

        // Analisar tipo de empresa se disponível
        if (dadosEmpresa.tipoEmpresa) {
            const setorPorTipo = classificarSetorPorTipo(dadosEmpresa.tipoEmpresa);
            if (setorPorTipo) {
                return {
                    ...configuracaoPadrao,
                    ...setorPorTipo,
                    fonteClassificacao: 'tipo_empresa'
                };
            }
        }

        // Analisar composição tributária para inferir setor
        if (dadosFiscais.composicaoTributaria) {
            const setorPorTributacao = classificarSetorPorTributacao(dadosFiscais.composicaoTributaria);
            if (setorPorTributacao) {
                return {
                    ...configuracaoPadrao,
                    ...setorPorTributacao,
                    fonteClassificacao: 'tributacao'
                };
            }
        }

        console.log('SPED-EXTRACTOR: Não foi possível determinar setor específico. Usando configuração padrão.');
        return configuracaoPadrao;

    } catch (erro) {
        console.error('SPED-EXTRACTOR: Erro ao determinar setor IVA:', erro);
        return configuracaoPadrao;
    }
}

/**
 * Classifica setor baseado no CNAE
 * @param {string} cnae - Código CNAE principal
 * @returns {Object|null} Configuração específica do setor
 */
function classificarSetorPorCnae(cnae) {
    if (!cnae) return null;

    const codigoCnae = cnae.replace(/[^0-9]/g, '').substring(0, 4);

    // Setores com tratamento diferenciado
    const setoresEspeciais = {
        // Agronegócio (01xx-03xx)
        agronegocio: {
            codigo: 'agronegocio',
            categoria: 'agronegocio',
            cbs: 0.088,
            ibs: 0.088, // Redução significativa para agronegócio
            reducaoEspecial: 0.6,
            pattern: /^(01|02|03)/
        },
        // Indústria (05xx-33xx)
        industria: {
            codigo: 'industria',
            categoria: 'industria',
            cbs: 0.088,
            ibs: 0.155, // Redução moderada
            reducaoEspecial: 0.2,
            pattern: /^(05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33)/
        },
        // Serviços de saúde (86xx)
        saude: {
            codigo: 'saude',
            categoria: 'saude',
            cbs: 0.088,
            ibs: 0.088, // Redução significativa
            reducaoEspecial: 0.5,
            pattern: /^86/
        },
        // Educação (85xx)
        educacao: {
            codigo: 'educacao',
            categoria: 'educacao',
            cbs: 0.088,
            ibs: 0.088, // Redução significativa
            reducaoEspecial: 0.5,
            pattern: /^85/
        }
    };

    for (const [nomeSetor, config] of Object.entries(setoresEspeciais)) {
        if (config.pattern.test(codigoCnae)) {
            console.log(`SPED-EXTRACTOR: Setor identificado por CNAE: ${nomeSetor} (${cnae})`);
            return {
                codigo: config.codigo,
                categoriaIva: config.categoria,
                cbs: config.cbs,
                ibs: config.ibs,
                reducaoEspecial: config.reducaoEspecial
            };
        }
    }

    return null;
}

/**
 * Classifica setor baseado no tipo de empresa
 * @param {string} tipoEmpresa - Tipo da empresa
 * @returns {Object|null} Configuração específica do setor
 */
function classificarSetorPorTipo(tipoEmpresa) {
    const tiposEspeciais = {
        'servicos': {
            codigo: 'servicos',
            categoriaIva: 'servicos',
            cbs: 0.088,
            ibs: 0.177,
            reducaoEspecial: 0
        },
        'industria': {
            codigo: 'industria',
            categoriaIva: 'industria',
            cbs: 0.088,
            ibs: 0.155,
            reducaoEspecial: 0.2
        },
        'comercio': {
            codigo: 'comercio',
            categoriaIva: 'comercio',
            cbs: 0.088,
            ibs: 0.177,
            reducaoEspecial: 0
        }
    };

    const config = tiposEspeciais[tipoEmpresa?.toLowerCase()];
    if (config) {
        console.log(`SPED-EXTRACTOR: Setor identificado por tipo: ${tipoEmpresa}`);
        return config;
    }

    return null;
}

/**
 * Classifica setor baseado na composição tributária
 * @param {Object} composicao - Composição tributária
 * @returns {Object|null} Configuração específica do setor
 */
function classificarSetorPorTributacao(composicao) {
    const { debitos, aliquotasEfetivas } = composicao;

    // Se há ISS significativo, provavelmente é empresa de serviços
    if (debitos.iss > 0 && debitos.iss > (debitos.icms || 0)) {
        console.log('SPED-EXTRACTOR: Setor identificado por tributação: serviços (ISS predominante)');
        return {
            codigo: 'servicos',
            categoriaIva: 'servicos',
            cbs: 0.088,
            ibs: 0.177,
            reducaoEspecial: 0
        };
    }

    // Se há IPI significativo, provavelmente é indústria
    if (debitos.ipi > 0) {
        console.log('SPED-EXTRACTOR: Setor identificado por tributação: indústria (IPI presente)');
        return {
            codigo: 'industria',
            categoriaIva: 'industria',
            cbs: 0.088,
            ibs: 0.155,
            reducaoEspecial: 0.2
        };
    }

    // Se há ICMS predominante sem IPI, provavelmente é comércio
    if (debitos.icms > 0 && !debitos.ipi) {
        console.log('SPED-EXTRACTOR: Setor identificado por tributação: comércio (ICMS sem IPI)');
        return {
            codigo: 'comercio',
            categoriaIva: 'comercio',
            cbs: 0.088,
            ibs: 0.177,
            reducaoEspecial: 0
        };
    }

    return null;
}

/**
 * Extrai CFOPs dos documentos
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {Array} - Lista de CFOPs encontrados
 */
function extrairCFOPs(dadosSped) {
    const cfops = new Set();
    
    if (dadosSped.itens?.length > 0) {
        dadosSped.itens.forEach(item => {
            if (item.cfop) cfops.add(item.cfop);
        });
    }

    if (dadosSped.itensAnaliticos?.length > 0) {
        dadosSped.itensAnaliticos.forEach(item => {
            if (item.cfop) cfops.add(item.cfop);
        });
    }

    return Array.from(cfops);
}

/**
 * Analisa CFOPs para determinar tipo de empresa
 * @param {Array} cfops - Lista de CFOPs encontrados
 * @returns {string} - Tipo de empresa identificado
 */
function analisarCFOPs(cfops) {
    const cfopsIndustria = [
        '5101', '5102', '5103', '5104', '5105', '5106', '5109',
        '6101', '6102', '6103', '6104', '6105', '6106', '6109',
        '5124', '5125', '6124', '6125', '5901', '5902', '6901', '6902'
    ];

    const cfopsServicos = [
        '5933', '5932', '5933', '6933', '6932', '9301', '9302',
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

    if (countIndustria > 0 && countIndustria >= Math.max(countComercio, countServicos)) {
        return 'industria';
    } else if (countServicos > countComercio) {
        return 'servicos';
    } else {
        return 'comercio';
    }
}

/**
 * Determina tipo de operação (B2B, B2C, mista)
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {string} - Tipo de operação identificado
 */
function determinarTipoOperacao(dadosSped) {
    if (!dadosSped.documentos?.length) {
        return 'b2b'; // Padrão conservador
    }

    const documentosSaida = dadosSped.documentos.filter(doc => doc.indOper === '1');
    if (documentosSaida.length === 0) return 'b2b';

    let countB2B = 0;
    let countB2C = 0;

    documentosSaida.forEach(doc => {
        if (doc.participante?.cnpjCpf) {
            if (doc.participante.cnpjCpf.length === 14) {
                countB2B++;
            } else {
                countB2C++;
            }
        } else if (doc.modelo === '65') { // NFC-e
            countB2C++;
        } else if (doc.modelo === '55') { // NF-e
            countB2B++;
        }
    });

    const totalDocs = countB2B + countB2C;
    if (totalDocs === 0) return 'b2b';

    const percentB2B = (countB2B / totalDocs) * 100;
    
    if (percentB2B > 80) return 'b2b';
    if (percentB2B < 20) return 'b2c';
    return 'mista';
}

/**
 * Calcula margem operacional
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {number} - Margem operacional calculada
 */
function calcularMargemOperacional(dadosSped) {
    // PRIORIDADE 1: Dados da ECD
    if (dadosSped.resultadoOperacional && dadosSped.receitaLiquida && dadosSped.receitaLiquida > 0) {
        return dadosSped.resultadoOperacional / dadosSped.receitaLiquida;
    }

    // PRIORIDADE 2: DRE da ECF
    if (dadosSped.dre?.resultado_operacional?.valor && dadosSped.dre?.receita_liquida?.valor) {
        return dadosSped.dre.resultado_operacional.valor / dadosSped.dre.receita_liquida.valor;
    }

    // PRIORIDADE 3: Estimativa por tipo de empresa
    const tipoEmpresa = determinarTipoEmpresa(dadosSped);
    const margensPadrao = {
        'comercio': 0.08,    // 8%
        'industria': 0.12,   // 12%
        'servicos': 0.15     // 15%
    };

    return margensPadrao[tipoEmpresa] || 0.1;
}

/**
 * Extrai dados do ciclo financeiro
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {Object} - Dados do ciclo financeiro
 */
function extrairCicloFinanceiro(dadosSped) {
    console.log('SPED-EXTRACTOR: Extraindo dados do ciclo financeiro');

    // Valores padrão
    const ciclo = {
        pmr: 30, // Prazo Médio de Recebimento (dias)
        pmp: 30, // Prazo Médio de Pagamento (dias)
        pme: 30, // Prazo Médio de Estocagem (dias)
        percVista: 0.3, // Percentual de vendas à vista
        percPrazo: 0.7 // Percentual de vendas a prazo
    };

    try {
        // Tentar extrair dados do ciclo financeiro a partir dos dados contábeis
        if (dadosSped.saldoClientes && dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
            // Validar valores
            const saldoClientes = validarValorSeguro(dadosSped.saldoClientes);
            const receitaBruta = validarValorSeguro(dadosSped.receitaBruta);

            if (saldoClientes > 0 && receitaBruta > 0) {
                // Calcular PMR: (Contas a Receber / Receita Bruta) * dias no período
                const pmrCalculado = Math.round((saldoClientes / (receitaBruta / 12)) * 30);

                // Validar resultado
                if (pmrCalculado > 0 && pmrCalculado <= 180) {
                    ciclo.pmr = pmrCalculado;
                    console.log(`SPED-EXTRACTOR: PMR calculado: ${pmrCalculado} dias`);
                } else {
                    console.warn(`SPED-EXTRACTOR: PMR calculado fora dos limites: ${pmrCalculado}, usando padrão`);
                }
            }
        }

        if (dadosSped.saldoFornecedores && dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
            // Validar valores
            const saldoFornecedores = validarValorSeguro(dadosSped.saldoFornecedores);
            const receitaBruta = validarValorSeguro(dadosSped.receitaBruta);

            if (saldoFornecedores > 0 && receitaBruta > 0) {
                // Estimar compras como um percentual da receita
                const comprasEstimadas = receitaBruta * 0.6; // 60% da receita

                // Calcular PMP: (Contas a Pagar / Compras) * dias no período
                const pmpCalculado = Math.round((saldoFornecedores / (comprasEstimadas / 12)) * 30);

                // Validar resultado
                if (pmpCalculado > 0 && pmpCalculado <= 180) {
                    ciclo.pmp = pmpCalculado;
                    console.log(`SPED-EXTRACTOR: PMP calculado: ${pmpCalculado} dias`);
                } else {
                    console.warn(`SPED-EXTRACTOR: PMP calculado fora dos limites: ${pmpCalculado}, usando padrão`);
                }
            }
        }

        if (dadosSped.saldoEstoques && dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
            // Validar valores
            const saldoEstoques = validarValorSeguro(dadosSped.saldoEstoques);
            const receitaBruta = validarValorSeguro(dadosSped.receitaBruta);

            if (saldoEstoques > 0 && receitaBruta > 0) {
                // Estimar CMV como um percentual da receita
                const cmvEstimado = receitaBruta * 0.7; // 70% da receita

                // Calcular PME: (Estoque / CMV) * dias no período
                const pmeCalculado = Math.round((saldoEstoques / (cmvEstimado / 12)) * 30);

                // Validar resultado
                if (pmeCalculado > 0 && pmeCalculado <= 180) {
                    ciclo.pme = pmeCalculado;
                    console.log(`SPED-EXTRACTOR: PME calculado: ${pmeCalculado} dias`);
                } else {
                    console.warn(`SPED-EXTRACTOR: PME calculado fora dos limites: ${pmeCalculado}, usando padrão`);
                }
            }
        }

        // Calcular percentual de vendas à vista com base nos documentos
        if (dadosSped.documentos?.length > 0) {
            const resultado = analisarVendasVista(dadosSped.documentos);

            // Validar resultados
            if (resultado.percVista >= 0 && resultado.percVista <= 1) {
                ciclo.percVista = resultado.percVista;
                ciclo.percPrazo = resultado.percPrazo;
                console.log(`SPED-EXTRACTOR: Percentual de vendas à vista calculado: ${(ciclo.percVista * 100).toFixed(1)}%`);
            }
        }
    } catch (erro) {
        console.warn('SPED-EXTRACTOR: Erro ao calcular ciclo financeiro:', erro);
    }

    console.log('SPED-EXTRACTOR: Ciclo financeiro calculado:', ciclo);
    return ciclo;
}

/**
 * Função auxiliar para validar valores
 * @param {*} valor - Valor a ser validado
 * @param {number} padrao - Valor padrão em caso de invalidez
 * @returns {number} - Valor validado
 */
function validarValorSeguro(valor, padrao = 0) {
    if (typeof valor === 'number') {
        if (!isNaN(valor) && valor >= 0 && valor < 1000000000) { // Entre 0 e 1 bilhão
            return valor;
        }
    } else if (typeof valor === 'string') {
        const valorNumerico = parseValorMonetario(valor);
        if (valorNumerico >= 0 && valorNumerico < 1000000000) { // Entre 0 e 1 bilhão
            return valorNumerico;
        }
    }

    return padrao;
}

/**
 * Função auxiliar para validar valores monetários
 * @param {*} valor - Valor a ser validado
 * @returns {number} - Valor validado
 */
function validarValorMonetario(valor) {
    // Se o valor for um objeto com propriedade valor, extrair apenas o valor
    if (valor && typeof valor === 'object' && valor.valor !== undefined) {
        return validarValorMonetario(valor.valor);
    }
    
    // Se for número, validar diretamente
    if (typeof valor === 'number') {
        return isNaN(valor) ? 0 : valor;
    }
    
    // Converter string para número
    if (typeof valor === 'string') {
        return parseValorMonetario(valor);
    }
    
    return 0;
}

/**
 * Analisa percentual de vendas à vista
 * @param {Array} documentos - Documentos fiscais
 * @returns {Object} - Percentuais calculados
 */
function analisarVendasVista(documentos) {
    if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
        return { percVista: 0.3, percPrazo: 0.7 }; // Valores padrão
    }

    // Filtrar documentos de saída
    const documentosSaida = documentos.filter(doc => 
        doc && typeof doc === 'object' && doc.indOper === '1'
    );

    if (documentosSaida.length === 0) {
        return { percVista: 0.3, percPrazo: 0.7 }; // Valores padrão
    }

    let valorTotalVendas = 0;
    let valorVendasVista = 0;

    documentosSaida.forEach(doc => {
        // Extrair e validar o valor do documento
        const valorDoc = validarValorSeguro(doc.valorTotal);

        if (valorDoc > 0) {
            valorTotalVendas += valorDoc;

            // Critérios para identificar venda à vista
            if (doc.modelo === '65' || doc.condicaoPagamento === '0' || doc.formaPagamento === 'vista') {
                valorVendasVista += valorDoc;
            }
        }
    });

    if (valorTotalVendas <= 0) {
        return { percVista: 0.3, percPrazo: 0.7 }; // Valores padrão
    }

    // Calcular percentuais
    const percVista = valorVendasVista / valorTotalVendas;

    // Garantir que o percentual está entre 5% e 95%
    const percVistaValidado = Math.max(0.05, Math.min(0.95, percVista));

    return { 
        percVista: percVistaValidado, 
        percPrazo: 1 - percVistaValidado 
    };
}

/**
 * Extrai dados para configuração IVA
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {Object} - Configuração IVA
 */
function extrairDadosIVA(dadosSped) {
    const tipoEmpresa = determinarTipoEmpresa(dadosSped);
    
    // Mapeamento básico para setores do IVA
    const setorBasico = {
        'comercio': 'comercio',
        'industria': 'industria',
        'servicos': 'servicos'
    }[tipoEmpresa] || 'comercio';

    // Valores padrão para IVA Dual
    return {
        cbs: 0.088,                    // 8,8%
        ibs: 0.177,                    // 17,7%
        categoriaIva: 'standard',
        reducaoEspecial: 0,
        codigoSetor: setorBasico
    };
}

/**
 * Extrai dados financeiros do SPED ECF e outros
 * @param {Object} dadosSped - Dados do SPED processados
 * @returns {Object} - Dados financeiros extraídos
 */
function extrairDadosFinanceiros(dadosSped) {
    console.log('SPED-EXTRACTOR: Extraindo dados financeiros');

    const dadosFinanceiros = {
        receitaBruta: 0,
        receitaLiquida: 0,
        custoTotal: 0,
        despesasOperacionais: 0,
        lucroOperacional: 0,
        margem: 0.15 // padrão
    };

    try {
        // Extrair da ECF (mais confiável para dados financeiros)
        if (dadosSped.ecf?.demonstracaoResultado?.length > 0) {
            const dre = dadosSped.ecf.demonstracaoResultado;

            // Buscar receita bruta
            const receitaBruta = dre.find(conta => 
                conta.codigoConta?.startsWith('3.01') || 
                conta.descricao?.toLowerCase().includes('receita') && 
                conta.descricao?.toLowerCase().includes('bruta')
            );
            if (receitaBruta) {
                dadosFinanceiros.receitaBruta = parseValorMonetario(receitaBruta.valor || receitaBruta.saldo);
            }

            // Buscar receita líquida
            const receitaLiquida = dre.find(conta => 
                conta.codigoConta?.startsWith('3.02') || 
                conta.descricao?.toLowerCase().includes('receita') && 
                conta.descricao?.toLowerCase().includes('líquida')
            );
            if (receitaLiquida) {
                dadosFinanceiros.receitaLiquida = parseValorMonetario(receitaLiquida.valor || receitaLiquida.saldo);
            }

            // Buscar custo das vendas
            const custoVendas = dre.find(conta => 
                conta.codigoConta?.startsWith('3.03') || 
                conta.descricao?.toLowerCase().includes('custo') && 
                (conta.descricao?.toLowerCase().includes('vendas') || conta.descricao?.toLowerCase().includes('mercadorias'))
            );
            if (custoVendas) {
                dadosFinanceiros.custoTotal = parseValorMonetario(custoVendas.valor || custoVendas.saldo);
            }

            // Buscar despesas operacionais
            const despesasOper = dre.filter(conta => 
                conta.codigoConta?.startsWith('3.04') || 
                conta.descricao?.toLowerCase().includes('despesas') && 
                conta.descricao?.toLowerCase().includes('operacionais')
            );
            if (despesasOper.length > 0) {
                dadosFinanceiros.despesasOperacionais = despesasOper.reduce((sum, conta) => 
                    sum + parseValorMonetario(conta.valor || conta.saldo), 0
                );
            }

            // Calcular lucro operacional
            dadosFinanceiros.lucroOperacional = dadosFinanceiros.receitaLiquida - 
                                               dadosFinanceiros.custoTotal - 
                                               dadosFinanceiros.despesasOperacionais;

            // Calcular margem
            if (dadosFinanceiros.receitaLiquida > 0) {
                dadosFinanceiros.margem = dadosFinanceiros.lucroOperacional / dadosFinanceiros.receitaLiquida;
            }
        }

        // Fallback: tentar estimar baseado em outros dados disponíveis
        if (dadosFinanceiros.receitaBruta === 0) {
            // Usar faturamento do SPED Fiscal ou Contribuições
            if (dadosSped.empresa?.faturamento > 0) {
                dadosFinanceiros.receitaBruta = dadosSped.empresa.faturamento;
                dadosFinanceiros.receitaLiquida = dadosFinanceiros.receitaBruta * 0.9; // Estimativa: 10% de deduções
            }
        }

        // Validar e ajustar valores
        if (dadosFinanceiros.custoTotal === 0 && dadosFinanceiros.receitaLiquida > 0) {
            // Estimar custo como 60% da receita líquida (padrão para comércio)
            dadosFinanceiros.custoTotal = dadosFinanceiros.receitaLiquida * 0.6;
        }

        console.log('SPED-EXTRACTOR: Dados financeiros extraídos:', dadosFinanceiros);
        return dadosFinanceiros;

    } catch (erro) {
        console.error('SPED-EXTRACTOR: Erro ao extrair dados financeiros:', erro);
        return dadosFinanceiros;
    }
}

/**
 * Processa arquivo SPED Fiscal (EFD ICMS/IPI)
 * @param {Array} linhas - Linhas do arquivo SPED
 * @returns {Object} Dados processados do SPED Fiscal
 */
function processarSPEDFiscal(linhas) {
    const dados = {
        empresa: {},
        documentos: [],
        resumosICMS: [],
        apuracaoICMS: null,
        totalizadores: {
            valorTotalSaidas: 0,
            baseCalculoICMS: 0,
            valorICMS: 0,
            valorIPI: 0
        }
    };

    let empresaProcessada = false;

    for (const linha of linhas) {
        try {
            const campos = linha.split('|');
            const registro = campos[1];

            switch (registro) {
                case '0000':
                    if (!empresaProcessada) {
                        dados.empresa = {
                            cnpj: campos[8],
                            nome: campos[9],
                            ie: campos[10],
                            uf: campos[11],
                            municipio: campos[14]
                        };
                        empresaProcessada = true;
                    }
                    break;

                case 'C100':
                    // Processar apenas saídas (CFOP 5xxx e 6xxx)
                    const cfop = campos[13];
                    if (cfop && (cfop.startsWith('5') || cfop.startsWith('6'))) {
                        const documento = {
                            tipo: 'saida',
                            cfop: cfop,
                            valorTotal: parseFloat(campos[17]?.replace(',', '.') || 0),
                            valorProdutos: parseFloat(campos[18]?.replace(',', '.') || 0),
                            baseCalculoICMS: parseFloat(campos[19]?.replace(',', '.') || 0),
                            valorICMS: parseFloat(campos[20]?.replace(',', '.') || 0),
                            valorIPI: parseFloat(campos[24]?.replace(',', '.') || 0)
                        };
                        dados.documentos.push(documento);

                        // Acumular totalizadores
                        dados.totalizadores.valorTotalSaidas += documento.valorTotal;
                        dados.totalizadores.baseCalculoICMS += documento.baseCalculoICMS;
                        dados.totalizadores.valorICMS += documento.valorICMS;
                        dados.totalizadores.valorIPI += documento.valorIPI;
                    }
                    break;

                case 'C190':
                    // Resumo por CST/CFOP/Alíquota
                    const resumo = {
                        cst: campos[2],
                        cfop: campos[3],
                        aliquota: parseFloat(campos[4]?.replace(',', '.') || 0),
                        valorContabil: parseFloat(campos[5]?.replace(',', '.') || 0),
                        baseCalculo: parseFloat(campos[6]?.replace(',', '.') || 0),
                        valorImposto: parseFloat(campos[7]?.replace(',', '.') || 0)
                    };
                    dados.resumosICMS.push(resumo);
                    break;

                case 'E110':
                    // Apuração do ICMS
                    dados.apuracaoICMS = {
                        valorTotalDebitos: parseFloat(campos[2]?.replace(',', '.') || 0),
                        valorTotalCreditos: parseFloat(campos[3]?.replace(',', '.') || 0),
                        valorTotalAjustesDebito: parseFloat(campos[4]?.replace(',', '.') || 0),
                        valorTotalAjustesCredito: parseFloat(campos[5]?.replace(',', '.') || 0),
                        saldoDevedor: parseFloat(campos[10]?.replace(',', '.') || 0)
                    };
                    break;
            }
        } catch (error) {
            console.warn(`Erro ao processar linha SPED Fiscal: ${error.message}`);
        }
    }

    return dados;
}

/**
 * Processa arquivo SPED Contribuições (EFD PIS/COFINS)
 * @param {Array} linhas - Linhas do arquivo SPED
 * @returns {Object} Dados processados do SPED Contribuições
 */
function processarSPEDContribuicoes(linhas) {
    const dados = {
        empresa: {},
        apuracaoPIS: null,
        apuracaoCOFINS: null,
        creditosPIS: [],
        creditosCOFINS: [],
        detalhesPIS: [],
        detalhesCOFINS: [],
        ajustesBC: {
            pis: [],    // Armazenar registros M215
            cofins: []  // Armazenar registros M615
        },
        receitas: {
            receitaBrutaTotal: 0,
            receitaTributavel: 0
        },
        regime: 'não-cumulativo' // padrão
    };

    let empresaProcessada = false;
    let registroM210Atual = null;
    let registroM610Atual = null;

    for (const linha of linhas) {
        try {
            const campos = linha.split('|');
            const registro = campos[1];

            switch (registro) {
                case '0000':
                    if (!empresaProcessada) {
                        dados.empresa = {
                            cnpj: campos[8],
                            nome: campos[9]
                        };
                        empresaProcessada = true;
                    }
                    break;

                case '0110':
                    // Regime de apuração
                    const indApuracao = campos[2];
                    dados.regime = indApuracao === '1' ? 'cumulativo' : 'não-cumulativo';
                    break;

                case '0111':
                    // Receita bruta
                    dados.receitas.receitaBrutaTotal = parseFloat(campos[2]?.replace(',', '.') || 0);
                    dados.receitas.receitaTributavel = parseFloat(campos[6]?.replace(',', '.') || 0);
                    break;

                case 'M100':
                    // Apuração PIS não-cumulativo
                    dados.apuracaoPIS = {
                        valorTotalCreditos: parseFloat(campos[2]?.replace(',', '.') || 0),
                        valorTotalDebitos: parseFloat(campos[3]?.replace(',', '.') || 0),
                        valorTotalAjustesCredito: parseFloat(campos[6]?.replace(',', '.') || 0),
                        valorTotalAjustesDebito: parseFloat(campos[7]?.replace(',', '.') || 0),
                        saldoDevedor: parseFloat(campos[11]?.replace(',', '.') || 0),
                        saldoCredorTransporte: parseFloat(campos[12]?.replace(',', '.') || 0)
                    };
                    break;

                case 'M105':
                    // Detalhamento de créditos PIS
                    const creditoPIS = {
                        cst: campos[2],
                        baseCalculo: parseFloat(campos[4]?.replace(',', '.') || 0),
                        valorCredito: parseFloat(campos[5]?.replace(',', '.') || 0)
                    };
                    dados.creditosPIS.push(creditoPIS);
                    break;

                case 'M210':
                    // Detalhamento de receitas PIS - NOVO LAYOUT
                    registroM210Atual = {
                        registro: 'M210',
                        receitaBruta: parseFloat(campos[3]?.replace(',', '.') || 0),       // VL_REC_BRT
                        valorBaseCalculoAntes: parseFloat(campos[4]?.replace(',', '.') || 0),   // VL_BC_CONT
                        valorAjustesAcrescimoBc: parseFloat(campos[5]?.replace(',', '.') || 0), // VL_AJUS_ACRES_BC_PIS
                        valorAjustesReducaoBc: parseFloat(campos[6]?.replace(',', '.') || 0),   // VL_AJUS_REDUC_BC_PIS
                        valorBaseCalculoAjustada: parseFloat(campos[7]?.replace(',', '.') || 0), // VL_BC_CONT_AJUS
                        aliqPis: parseFloat(campos[8]?.replace(',', '.') || 0),              // ALIQ_PIS
                        valorContribApurada: parseFloat(campos[11]?.replace(',', '.') || 0),  // VL_CONT_APUR
                        valorAjustesAcrescimo: parseFloat(campos[12]?.replace(',', '.') || 0), // VL_AJUS_ACRES
                        valorAjustesReducao: parseFloat(campos[13]?.replace(',', '.') || 0),   // VL_AJUS_REDUC
                        valorContribDiferir: parseFloat(campos[14]?.replace(',', '.') || 0),   // VL_CONT_DIFER (opcional)
                        valorContribDiferidaAnt: parseFloat(campos[15]?.replace(',', '.') || 0), // VL_CONT_DIFER_ANT (opcional)
                        valorContribPeriodo: parseFloat(campos[16]?.replace(',', '.') || 0)    // VL_CONT_PER
                    };
                    dados.detalhesPIS.push(registroM210Atual);
                    break;

                case 'M215':
                    // Ajustes da Base de Cálculo PIS - NOVO REGISTRO
                    if (registroM210Atual) {
                        const ajusteM215 = {
                            registro: 'M215',
                            indAjusteBc: campos[2],                                    // IND_AJ_BC (0=Acréscimo, 1=Redução)
                            valorAjusteBc: parseFloat(campos[3]?.replace(',', '.') || 0), // VL_AJ_BC
                            codAjusteBc: campos[4],                                     // COD_AJ_BC
                            descrAjusteBc: campos[6] || ''                             // NUM_DOC ou DESCR_AJ_BC
                        };
                        dados.ajustesBC.pis.push(ajusteM215);
                    }
                    break;

                case 'M500':
                    // Apuração COFINS não-cumulativo
                    dados.apuracaoCOFINS = {
                        valorTotalCreditos: parseFloat(campos[2]?.replace(',', '.') || 0),
                        valorTotalDebitos: parseFloat(campos[3]?.replace(',', '.') || 0),
                        valorTotalAjustesCredito: parseFloat(campos[6]?.replace(',', '.') || 0),
                        valorTotalAjustesDebito: parseFloat(campos[7]?.replace(',', '.') || 0),
                        saldoDevedor: parseFloat(campos[11]?.replace(',', '.') || 0),
                        saldoCredorTransporte: parseFloat(campos[12]?.replace(',', '.') || 0)
                    };
                    break;

                case 'M505':
                    // Detalhamento de créditos COFINS
                    const creditoCOFINS = {
                        cst: campos[2],
                        baseCalculo: parseFloat(campos[4]?.replace(',', '.') || 0),
                        valorCredito: parseFloat(campos[5]?.replace(',', '.') || 0)
                    };
                    dados.creditosCOFINS.push(creditoCOFINS);
                    break;

                case 'M610':
                    // Detalhamento de receitas COFINS - NOVO LAYOUT
                    registroM610Atual = {
                        registro: 'M610',
                        receitaBruta: parseFloat(campos[3]?.replace(',', '.') || 0),       // VL_REC_BRT
                        valorBaseCalculoAntes: parseFloat(campos[4]?.replace(',', '.') || 0),   // VL_BC_CONT
                        valorAjustesAcrescimoBc: parseFloat(campos[5]?.replace(',', '.') || 0), // VL_AJUS_ACRES_BC_COFINS
                        valorAjustesReducaoBc: parseFloat(campos[6]?.replace(',', '.') || 0),   // VL_AJUS_REDUC_BC_COFINS
                        valorBaseCalculoAjustada: parseFloat(campos[7]?.replace(',', '.') || 0), // VL_BC_CONT_AJUS
                        aliqCofins: parseFloat(campos[8]?.replace(',', '.') || 0),          // ALIQ_COFINS
                        valorContribApurada: parseFloat(campos[11]?.replace(',', '.') || 0),  // VL_CONT_APUR
                        valorAjustesAcrescimo: parseFloat(campos[12]?.replace(',', '.') || 0), // VL_AJUS_ACRES
                        valorAjustesReducao: parseFloat(campos[13]?.replace(',', '.') || 0),   // VL_AJUS_REDUC
                        valorContribDiferir: parseFloat(campos[14]?.replace(',', '.') || 0),   // VL_CONT_DIFER (opcional)
                        valorContribDiferidaAnt: parseFloat(campos[15]?.replace(',', '.') || 0), // VL_CONT_DIFER_ANT (opcional)
                        valorContribPeriodo: parseFloat(campos[16]?.replace(',', '.') || 0)    // VL_CONT_PER
                    };
                    dados.detalhesCOFINS.push(registroM610Atual);
                    break;

                case 'M615':
                    // Ajustes da Base de Cálculo COFINS - NOVO REGISTRO
                    if (registroM610Atual) {
                        const ajusteM615 = {
                            registro: 'M615',
                            indAjusteBc: campos[2],                                    // IND_AJ_BC (0=Acréscimo, 1=Redução)
                            valorAjusteBc: parseFloat(campos[3]?.replace(',', '.') || 0), // VL_AJ_BC
                            codAjusteBc: campos[4],                                     // COD_AJ_BC
                            descrAjusteBc: campos[6] || ''                             // NUM_DOC ou DESCR_AJ_BC
                        };
                        dados.ajustesBC.cofins.push(ajusteM615);
                    }
                    break;
            }
        } catch (error) {
            console.warn(`Erro ao processar linha SPED Contribuições: ${error.message}`);
        }
    }

    return dados;
}

/**
 * Calcula alíquotas efetivas baseadas nos dados reais
 * @param {Object} dadosFiscal - Dados do SPED Fiscal
 * @param {Object} dadosContribuicoes - Dados do SPED Contribuições
 * @returns {Object} - Alíquotas efetivas calculadas
 */
function calcularAliquotasEfetivas(dadosFiscal, dadosContribuicoes) {
    const aliquotas = {
        pisEfetivo: 0,
        cofinsEfetivo: 0,
        icmsEfetivo: 0,
        ipiEfetivo: 0,
        issEfetivo: 0
    };

    // Calcular faturamento mensal (base para alíquotas efetivas)
    const faturamentoMensal = dadosContribuicoes?.receitas?.receitaBrutaTotal || 
                              dadosFiscal?.totalizadores?.valorTotalSaidas || 0;

    if (faturamentoMensal > 0) {
        // PIS Efetivo
        const totalPIS = dadosContribuicoes?.detalhesPIS?.reduce((acc, item) => 
            acc + item.valorContribApurada, 0) || 0;
        // Armazenar como percentual (0-100), não como decimal (0-1)
        aliquotas.pisEfetivo = (totalPIS / faturamentoMensal) * 100;

        // COFINS Efetivo
        const totalCOFINS = dadosContribuicoes?.detalhesCOFINS?.reduce((acc, item) => 
            acc + item.valorContribApurada, 0) || 0;
        // Armazenar como percentual (0-100), não como decimal (0-1)
        aliquotas.cofinsEfetivo = (totalCOFINS / faturamentoMensal) * 100;

        // ICMS Efetivo
        const totalICMS = dadosFiscal?.totalizadores?.valorICMS || 0;
        // Armazenar como percentual (0-100), não como decimal (0-1)
        aliquotas.icmsEfetivo = (totalICMS / faturamentoMensal) * 100;

        // IPI Efetivo
        const totalIPI = dadosFiscal?.totalizadores?.valorIPI || 0;
        // Armazenar como percentual (0-100), não como decimal (0-1)
        aliquotas.ipiEfetivo = (totalIPI / faturamentoMensal) * 100;
    }

    return aliquotas;
}

/**
 * Calcula composição tributária com débitos e créditos corretos
 * @param {Object} dadosFiscal - Dados do SPED Fiscal
 * @param {Object} dadosContribuicoes - Dados do SPED Contribuições
 * @returns {Object} - Composição tributária calculada
 */
function calcularComposicaoTributaria(dadosFiscal, dadosContribuicoes) {
    const composicao = {
        debitos: {
            pis: 0,
            cofins: 0,
            icms: 0,
            ipi: 0,
            iss: 0
        },
        creditos: {
            pis: 0,
            cofins: 0,
            icms: 0,
            ipi: 0,
            iss: 0
        }
    };

    // Débitos PIS
    if (dadosContribuicoes?.detalhesPIS) {
        composicao.debitos.pis = dadosContribuicoes.detalhesPIS.reduce((acc, item) => 
            acc + item.valorContribPeriodo, 0);
    }

    // Débitos COFINS
    if (dadosContribuicoes?.detalhesCOFINS) {
        composicao.debitos.cofins = dadosContribuicoes.detalhesCOFINS.reduce((acc, item) => 
            acc + item.valorContribPeriodo, 0);
    }

    // Créditos PIS
    if (dadosContribuicoes?.creditosPIS) {
        composicao.creditos.pis = dadosContribuicoes.creditosPIS.reduce((acc, item) => 
            acc + item.valorCredito, 0);
    }

    // Créditos COFINS
    if (dadosContribuicoes?.creditosCOFINS) {
        composicao.creditos.cofins = dadosContribuicoes.creditosCOFINS.reduce((acc, item) => 
            acc + item.valorCredito, 0);
    }

    // ICMS
    composicao.debitos.icms = dadosFiscal?.totalizadores?.valorICMS || 0;
    composicao.creditos.icms = dadosFiscal?.apuracaoICMS?.valorTotalCreditos || 0;

    // IPI
    composicao.debitos.ipi = dadosFiscal?.totalizadores?.valorIPI || 0;

    return composicao;
}

/**
 * Calcula parâmetros fiscais com rastreamento de fonte e suporte ao novo layout
 * @param {Object} spedFiscal - Dados do SPED Fiscal
 * @param {Object} spedContribuicoes - Dados do SPED Contribuições
 * @returns {Object} - Parâmetros fiscais consolidados
 */
function calcularParametrosFiscais(spedFiscal, spedContribuicoes) {
    console.log('SPED-EXTRACTOR: Calculando parâmetros fiscais com rastreamento de fonte');

    const parametros = {
        sistemaAtual: {
            regimeTributario: 'real',
            regimePISCOFINS: 'não-cumulativo'
        },
        composicaoTributaria: {
            debitos: {},
            creditos: {},
            aliquotasEfetivas: {},
            fontesDados: {}, // Rastreamento de fontes
            ajustesBC: {} // Novo campo para armazenar ajustes de BC
        },
        validacoesTecnicas: {
            baseCalculoAjustada: {
                pis: { valida: true, divergencia: 0, formula: '' },
                cofins: { valida: true, divergencia: 0, formula: '' }
            },
            contribuicaoFinal: {
                pis: { valida: true, divergencia: 0, formula: '' },
                cofins: { valida: true, divergencia: 0, formula: '' }
            },
            ajustesDetalhados: {
                pis: { processado: false, registrosM215: 0, consistente: true },
                cofins: { processado: false, registrosM615: 0, consistente: true }
            }
        }
    };

    try {
        // Determinar regime tributário e PIS/COFINS
        const regime = determinarRegimeTributario(spedFiscal || spedContribuicoes);
        const regimePisCofins = determinarRegimePisCofins(spedFiscal || spedContribuicoes);

        parametros.sistemaAtual.regimeTributario = regime;
        parametros.sistemaAtual.regimePISCOFINS = regimePisCofins;

        // Calcular faturamento mensal para estimativas
        let faturamentoMensal = 0;

        if (spedContribuicoes?.receitas?.receitaBrutaTotal > 0) {
            faturamentoMensal = spedContribuicoes.receitas.receitaBrutaTotal;
        } else if (spedFiscal?.totalizadores?.valorTotalSaidas > 0) {
            faturamentoMensal = spedFiscal.totalizadores.valorTotalSaidas;
        } else if (spedFiscal?.documentos?.length > 0) {
            faturamentoMensal = calcularFaturamentoMensal(spedFiscal.documentos);
        }

        // =========== PROCESSAMENTO DE PIS ===========

        // Processar débitos PIS - usando novos registros M210/M215 quando disponíveis
        const debitoPIS = calcularDebitosPIS(spedContribuicoes || {}, faturamentoMensal);
        parametros.composicaoTributaria.debitos.pis = debitoPIS;

        // Verificar se temos M210 (novo layout) para extrair dados adicionais
        if (spedContribuicoes?.debitos?.pis) {
            const registrosM210 = spedContribuicoes.debitos.pis.filter(reg => reg.registro === 'M210');

            if (registrosM210.length > 0) {
                const regM210 = registrosM210[0]; // Usar o primeiro registro M210

                // Validar fórmula da base de cálculo ajustada
                const validacaoBaseCalculoPIS = validarBaseCalculoAjustada(regM210, 'PIS');
                parametros.validacoesTecnicas.baseCalculoAjustada.pis = validacaoBaseCalculoPIS;

                // Validar fórmula da contribuição final
                const validacaoContribuicaoPIS = validarContribuicaoFinal(regM210, 'PIS');
                parametros.validacoesTecnicas.contribuicaoFinal.pis = validacaoContribuicaoPIS;

                // Extrair dados de base de cálculo e ajustes
                parametros.composicaoTributaria.ajustesBC.pis = {
                    baseCalculoOriginal: parseValorMonetario(regM210.valorBaseCalculoAntes || 0),
                    ajustesAcrescimo: parseValorMonetario(regM210.valorAjustesAcrescimoBc || 0),
                    ajustesReducao: parseValorMonetario(regM210.valorAjustesReducaoBc || 0),
                    baseCalculoAjustada: parseValorMonetario(regM210.valorBaseCalculoAjustada || 0)
                };

                // Fonte da informação
                parametros.composicaoTributaria.fontesDados.pis = 'sped_m210';

                // Verificar se temos M215 para detalhamento dos ajustes
                if (spedContribuicoes.ajustesBaseCalculo?.pis) {
                    const ajustesM215 = spedContribuicoes.ajustesBaseCalculo.pis;

                    // Processar registros M215
                    const resultadoM215 = processarRegistrosM215(ajustesM215, regM210);
                    
                    // Atualizar dados de validação
                    parametros.validacoesTecnicas.ajustesDetalhados.pis = {
                        processado: true,
                        registrosM215: ajustesM215.length,
                        consistente: resultadoM215.consistente
                    };

                    // Armazenar detalhamento dos ajustes
                    parametros.composicaoTributaria.ajustesBC.pis.detalhamento = resultadoM215.detalhamento;
                }
            } else {
                parametros.composicaoTributaria.fontesDados.pis = 'sped';
            }
        } else {
            parametros.composicaoTributaria.fontesDados.pis = 'estimado';
        }

        // Processar créditos PIS
        const creditoPIS = calcularCreditosPIS(spedContribuicoes || {});
        parametros.composicaoTributaria.creditos.pis = creditoPIS;

        // =========== PROCESSAMENTO DE COFINS ===========

        // Processar débitos COFINS - usando novos registros M610/M615 quando disponíveis
        const debitoCOFINS = calcularDebitosCOFINS(spedContribuicoes || {}, faturamentoMensal);
        parametros.composicaoTributaria.debitos.cofins = debitoCOFINS;

        // Verificar se temos M610 (novo layout) para extrair dados adicionais
        if (spedContribuicoes?.debitos?.cofins) {
            const registrosM610 = spedContribuicoes.debitos.cofins.filter(reg => reg.registro === 'M610');

            if (registrosM610.length > 0) {
                const regM610 = registrosM610[0]; // Usar o primeiro registro M610

                // Validar fórmula da base de cálculo ajustada
                const validacaoBaseCalculoCOFINS = validarBaseCalculoAjustada(regM610, 'COFINS');
                parametros.validacoesTecnicas.baseCalculoAjustada.cofins = validacaoBaseCalculoCOFINS;

                // Validar fórmula da contribuição final
                const validacaoContribuicaoCOFINS = validarContribuicaoFinal(regM610, 'COFINS');
                parametros.validacoesTecnicas.contribuicaoFinal.cofins = validacaoContribuicaoCOFINS;

                // Extrair dados de base de cálculo e ajustes
                parametros.composicaoTributaria.ajustesBC.cofins = {
                    baseCalculoOriginal: parseValorMonetario(regM610.valorBaseCalculoAntes || 0),
                    ajustesAcrescimo: parseValorMonetario(regM610.valorAjustesAcrescimoBc || 0),
                    ajustesReducao: parseValorMonetario(regM610.valorAjustesReducaoBc || 0),
                    baseCalculoAjustada: parseValorMonetario(regM610.valorBaseCalculoAjustada || 0)
                };

                // Fonte da informação
                parametros.composicaoTributaria.fontesDados.cofins = 'sped_m610';

                // Verificar se temos M615 para detalhamento dos ajustes
                if (spedContribuicoes.ajustesBaseCalculo?.cofins) {
                    const ajustesM615 = spedContribuicoes.ajustesBaseCalculo.cofins;

                    // Processar registros M615
                    const resultadoM615 = processarRegistrosM615(ajustesM615, regM610);
                    
                    // Atualizar dados de validação
                    parametros.validacoesTecnicas.ajustesDetalhados.cofins = {
                        processado: true,
                        registrosM615: ajustesM615.length,
                        consistente: resultadoM615.consistente
                    };

                    // Armazenar detalhamento dos ajustes
                    parametros.composicaoTributaria.ajustesBC.cofins.detalhamento = resultadoM615.detalhamento;
                }
            } else {
                parametros.composicaoTributaria.fontesDados.cofins = 'sped';
            }
        } else {
            parametros.composicaoTributaria.fontesDados.cofins = 'estimado';
        }

        // Processar créditos COFINS
        const creditoCOFINS = calcularCreditosCOFINS(spedContribuicoes || {});
        parametros.composicaoTributaria.creditos.cofins = creditoCOFINS;

        // =========== PROCESSAMENTO DE ICMS ===========

        // Processar débitos e créditos ICMS
        if (spedFiscal?.debitos?.icms) {
            const debitoICMS = calcularDebitosICMS(spedFiscal, faturamentoMensal);
            parametros.composicaoTributaria.debitos.icms = debitoICMS;
            parametros.composicaoTributaria.fontesDados.icms = 'sped';

            const creditoICMS = calcularCreditosICMS(spedFiscal);
            parametros.composicaoTributaria.creditos.icms = creditoICMS;
        } else {
            const debitoICMS = calcularDebitosICMS({}, faturamentoMensal);
            parametros.composicaoTributaria.debitos.icms = debitoICMS;
            parametros.composicaoTributaria.fontesDados.icms = 'estimado';
        }

        // =========== PROCESSAMENTO DE IPI ===========

        // Processar débitos e créditos IPI
        if (spedFiscal?.debitos?.ipi) {
            const debitoIPI = calcularDebitosIPI(spedFiscal, faturamentoMensal);
            parametros.composicaoTributaria.debitos.ipi = debitoIPI;
            parametros.composicaoTributaria.fontesDados.ipi = 'sped';

            const creditoIPI = calcularCreditosIPI(spedFiscal);
            parametros.composicaoTributaria.creditos.ipi = creditoIPI;
        } else {
            const debitoIPI = calcularDebitosIPI({}, faturamentoMensal);
            parametros.composicaoTributaria.debitos.ipi = debitoIPI;
            parametros.composicaoTributaria.fontesDados.ipi = 'estimado';
        }

        // =========== PROCESSAMENTO DE ISS ===========

        // Processar débitos ISS (sem créditos)
        const debitoISS = calcularDebitosISS(spedFiscal || {}, faturamentoMensal);
        parametros.composicaoTributaria.debitos.iss = debitoISS;
        parametros.composicaoTributaria.creditos.iss = 0; // ISS não gera créditos
        parametros.composicaoTributaria.fontesDados.iss = 'estimado'; // ISS geralmente é estimado

        // =========== CÁLCULO DE ALÍQUOTAS EFETIVAS ===========

        // Calcular alíquotas efetivas
        if (faturamentoMensal > 0) {
            // Para cada imposto
            ['pis', 'cofins', 'icms', 'ipi', 'iss'].forEach(imposto => {
                const debito = parametros.composicaoTributaria.debitos[imposto] || 0;
                const credito = parametros.composicaoTributaria.creditos[imposto] || 0;

                // Imposto líquido (nunca negativo)
                const impostoLiquido = Math.max(0, debito - credito);

                // Alíquota efetiva (em decimal)
                const aliquotaEfetiva = impostoLiquido / faturamentoMensal;

                // Validar resultado (entre 0 e 1)
                if (aliquotaEfetiva >= 0 && aliquotaEfetiva <= 1) {
                    parametros.composicaoTributaria.aliquotasEfetivas[imposto] = aliquotaEfetiva;
                } else {
                    console.warn(`SPED-EXTRACTOR: Alíquota efetiva de ${imposto} fora dos limites: ${aliquotaEfetiva}, usando 0`);
                    parametros.composicaoTributaria.aliquotasEfetivas[imposto] = 0;
                }
            });

            // Alíquota total
            const totalLiquido = Object.keys(parametros.composicaoTributaria.debitos)
                .reduce((sum, imposto) => {
                    const debito = parametros.composicaoTributaria.debitos[imposto] || 0;
                    const credito = parametros.composicaoTributaria.creditos[imposto] || 0;
                    return sum + Math.max(0, debito - credito);
                }, 0);

            const aliquotaTotal = totalLiquido / faturamentoMensal;

            if (aliquotaTotal >= 0 && aliquotaTotal <= 1) {
                parametros.composicaoTributaria.aliquotasEfetivas.total = aliquotaTotal;
            } else {
                console.warn(`SPED-EXTRACTOR: Alíquota total fora dos limites: ${aliquotaTotal}, usando 0`);
                parametros.composicaoTributaria.aliquotasEfetivas.total = 0;
            }
        }

        // Log dos resultados
        console.log('SPED-EXTRACTOR: Parâmetros fiscais calculados com sucesso:', {
            regime: parametros.sistemaAtual.regimeTributario,
            regimePisCofins: parametros.sistemaAtual.regimePISCOFINS,
            debitosPIS: parametros.composicaoTributaria.debitos.pis,
            creditosPIS: parametros.composicaoTributaria.creditos.pis,
            debitosCOFINS: parametros.composicaoTributaria.debitos.cofins,
            creditosCOFINS: parametros.composicaoTributaria.creditos.cofins,
            aliquotaEfetivaPIS: parametros.composicaoTributaria.aliquotasEfetivas.pis,
            aliquotaEfetivaCOFINS: parametros.composicaoTributaria.aliquotasEfetivas.cofins,
            aliquotaTotal: parametros.composicaoTributaria.aliquotasEfetivas.total
        });

        return parametros;
    } catch (erro) {
        console.error('SPED-EXTRACTOR: Erro ao calcular parâmetros fiscais:', erro);
        return parametros;
    }
}

/**
 * Estima valores ausentes com base em dados disponíveis
 * @param {Object} parametros - Parâmetros calculados
 * @param {Object} spedFiscal - Dados do SPED Fiscal
 * @param {Object} spedContribuicoes - Dados do SPED Contribuições
 */
function estimarValoresAusentes(parametros, spedFiscal, spedContribuicoes) {
    const composicao = parametros.composicaoTributaria;

    // Se não tem COFINS mas tem PIS, estimar COFINS (proporção 7,6/1,65)
    if (!composicao.debitos.cofins && composicao.debitos.pis) {
        const valorPIS = extrairValorNumerico(composicao.debitos.pis);
        const cofinsEstimado = valorPIS * (7.6 / 1.65);
        composicao.debitos.cofins = criarValorComFonte(cofinsEstimado, FonteDados.ESTIMADO, {
            baseadoEm: 'PIS',
            proporcao: '7.6/1.65'
        });
        composicao.fontesDados.cofins_debito = FonteDados.ESTIMADO;
    }

    // Se não tem PIS mas tem COFINS, estimar PIS
    if (!composicao.debitos.pis && composicao.debitos.cofins) {
        const valorCOFINS = extrairValorNumerico(composicao.debitos.cofins);
        const pisEstimado = valorCOFINS * (1.65 / 7.6);
        composicao.debitos.pis = criarValorComFonte(pisEstimado, FonteDados.ESTIMADO, {
            baseadoEm: 'COFINS',
            proporcao: '1.65/7.6'
        });
        composicao.fontesDados.pis_debito = FonteDados.ESTIMADO;
    }

    // Estimar ICMS se ausente (baseado na média do setor)
    if (!composicao.debitos.icms) {
        const valorPISCOFINS = (extrairValorNumerico(composicao.debitos.pis) || 0) + 
                              (extrairValorNumerico(composicao.debitos.cofins) || 0);
        if (valorPISCOFINS > 0) {
            // Estimativa: ICMS geralmente é 3-4x o valor de PIS+COFINS
            const icmsEstimado = valorPISCOFINS * 3.5;
            composicao.debitos.icms = criarValorComFonte(icmsEstimado, FonteDados.ESTIMADO, {
                baseadoEm: 'PIS+COFINS',
                multiplicador: '3.5'
            });
            composicao.fontesDados.icms_debito = FonteDados.ESTIMADO;
        }
    }
}

/**
 * Calcula alíquota média ICMS a partir dos resumos por CST/CFOP/Alíquota
 * @param {Object} dadosFiscal - Dados do SPED Fiscal
 * @returns {number} - Alíquota média calculada (em percentual)
 */
function calcularAliquotaMediaICMS(dadosFiscal) {
    if (!dadosFiscal?.resumosICMS || dadosFiscal.resumosICMS.length === 0) {
        return 18; // padrão
    }

    let totalBase = 0;
    let totalImposto = 0;

    dadosFiscal.resumosICMS.forEach(resumo => {
        if (resumo.baseCalculo > 0 && resumo.valorImposto > 0) {
            totalBase += resumo.baseCalculo;
            totalImposto += resumo.valorImposto;
        }
    });

    return totalBase > 0 ? (totalImposto / totalBase) * 100 : 18;
}

// Interface pública
return {
    extrairDadosParaSimulador,
    calcularParametrosFiscais,
    processarSPEDFiscal,
    processarSPEDContribuicoes,
    validarBaseCalculoAjustada,
    validarContribuicaoFinal,
    processarRegistrosM215,
    processarRegistrosM615,
    versao: '2.0.0-atualizado'
};
})();

// Garantir carregamento global
if (typeof window !== 'undefined') {
    window.SpedExtractor = SpedExtractor;
    console.log('SPED-EXTRACTOR: Módulo atualizado carregado com sucesso na versão', SpedExtractor.versao);
}
