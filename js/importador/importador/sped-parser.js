/**
 * SpedParser - Módulo para processamento de arquivos SPED
 * Responsável por ler e analisar arquivos SPED de diferentes tipos
 */
const SpedParser = (function() {
    // Tipos de registros por tipo de SPED
    const registrosMapeados = {
        fiscal: {
            '0000': parseRegistro0000,
            'C100': parseRegistroC100,
            'C170': parseRegistroC170,
            'C190': parseRegistroC190,
            'E110': parseRegistroE110,
            'E111': parseRegistroE111,
            'E200': parseRegistroE200,  // NOVO: Apuração IPI
            'E210': parseRegistroE210,  // NOVO: Ajustes IPI
            'C197': parseRegistroC197,
            'H010': parseRegistroH010,
            '0150': parseRegistro0150
        },
        contribuicoes: {
            '0000': parseRegistro0000Contribuicoes,
            '0110': parseRegistro0110,
            'M100': parseRegistroM100,
            'M105': parseRegistroM105,
            'M200': parseRegistroM200,
            'M205': parseRegistroM205,  // NOVO: Ajustes PIS
            'M210': parseRegistroM210,  // NOVO: Detalhamento PIS
            'M500': parseRegistroM500,
            'M505': parseRegistroM505,
            'M600': parseRegistroM600,
            'M605': parseRegistroM605,  // NOVO: Ajustes COFINS
            'M610': parseRegistroM610,  // NOVO: Detalhamento COFINS
            'M400': parseRegistroM400,
            'M800': parseRegistroM800,
            '1001': parseRegistro1001,  // NOVO: Registro de Encerramento
            '1100': parseRegistro1100,  // NOVO: Totalização PIS
            '1500': parseRegistro1500   // NOVO: Totalização COFINS
        },
        ecf: {
            '0000': parseRegistro0000ECF,
            '0010': parseRegistro0010ECF,
            'M010': parseRegistroM010ECF,
            'N500': parseRegistroN500ECF,
            'N660': parseRegistroN660ECF,
            'N670': parseRegistroN670ECF,
            'Y540': parseRegistroY540ECF
        },
        ecd: {
            '0000': parseRegistro0000ECD,
            'I200': parseRegistroI200ECD,
            'J100': parseRegistroJ100ECD,
            'J150': parseRegistroJ150ECD,
            'I250': parseRegistroI250ECD
        }
    };

    /**
     * Processa um arquivo SPED e extrai os dados relevantes
     * @param {File} arquivo - Arquivo SPED a ser processado
     * @param {string} tipo - Tipo de SPED (fiscal, contribuicoes, ecf, ecd)
     * @returns {Promise} Promessa com os dados extraídos
     */
    function processarArquivo(arquivo, tipo) {
        return new Promise((resolve, reject) => {
            if (!arquivo) {
                reject(new Error('Arquivo não fornecido'));
                return;
            }

            const reader = new FileReader();

            reader.onload = function(e) {
                try {
                    const conteudo = e.target.result;
                    const linhas = conteudo.split('\n');
                    const dadosExtraidos = extrairDados(linhas, tipo);
                    resolve(dadosExtraidos);
                } catch (erro) {
                    reject(erro);
                }
            };

            reader.onerror = function() {
                reject(new Error('Erro ao ler o arquivo'));
            };

            reader.readAsText(arquivo);
        });
    }

    /**
     * Extrai dados relevantes das linhas do arquivo SPED
     * @param {Array} linhas - Linhas do arquivo SPED
     * @param {string} tipo - Tipo de SPED
     * @returns {Object} Objeto com dados extraídos
     */
    function extrairDados(linhas, tipo) {
        // Inicializa objeto de resultado com estrutura expandida
        const resultado = {
            empresa: {},
            documentos: [],
            itens: [],
            itensAnaliticos: [],
            impostos: {},
            creditos: {},
            debitos: {}, // Adicionar esta propriedade para armazenar débitos
            regimes: {},
            ajustes: {},
            receitasNaoTributadas: {},
            balancoPatrimonial: [],
            demonstracaoResultado: [],
            lancamentosContabeis: [],
            partidasLancamento: [],
            calculoImposto: {}
        };

        // Determina o tipo de SPED para mapear os registros corretamente
        let tipoSped = tipo;
        if (!tipoSped) {
            // Tenta determinar o tipo automaticamente
            tipoSped = determinarTipoSped(linhas);
        }

        // Se ainda não foi possível determinar o tipo, usa "fiscal" como padrão
        if (!tipoSped || !registrosMapeados[tipoSped]) {
            console.warn(`Tipo SPED não reconhecido ou não suportado: ${tipoSped}. Usando "fiscal" como padrão.`);
            tipoSped = 'fiscal';
        }

        // Processa as linhas
        // Dentro da função extrairDados, substituir o bloco try/catch existente:
        for (const linha of linhas) {
            if (!linha.trim()) continue;

            const campos = linha.split('|');
            const registro = campos[1];

            // Verifica se o registro é mapeado para este tipo de SPED
            if (registrosMapeados[tipoSped] && registrosMapeados[tipoSped][registro]) {
                try {
                    // Processa o registro com a função específica
                    const dadosRegistro = registrosMapeados[tipoSped][registro](campos);

                    // Só integra se o resultado for válido
                    if (dadosRegistro && dadosRegistro !== null) {
                        integrarDados(resultado, dadosRegistro, registro);
                    }
                } catch (erro) {
                    // Log mais detalhado do erro sem interromper o processamento
                    console.warn(`Erro ao processar registro ${registro}:`, {
                        erro: erro.message,
                        linha: linha.substring(0, 100) + '...',
                        campos: campos.length,
                        tipoSped: tipoSped
                    });
                    
                    // Continua processamento dos demais registros
                    continue;
                }
            }
        }

        // Processa relações entre dados após extração completa
        processarRelacoesEntreDados(resultado, tipoSped);

        return resultado;
    }
    
    function processarRelacoesEntreDados(resultado, tipoSped) {
        // Relaciona itens a documentos
        if (resultado.documentos.length > 0 && resultado.itens.length > 0) {
            // Agrupa itens por documento
            const itensPorDocumento = {};

            resultado.itens.forEach(item => {
                const docId = item.documentoId || '';
                if (!itensPorDocumento[docId]) {
                    itensPorDocumento[docId] = [];
                }
                itensPorDocumento[docId].push(item);
            });

            // Associa itens aos documentos correspondentes
            resultado.documentos.forEach(doc => {
                const itensDoc = itensPorDocumento[doc.id] || [];
                doc.itens = itensDoc;
            });
        }

        // Relaciona participantes a documentos
        if (resultado.documentos.length > 0 && resultado.participantes && resultado.participantes.length > 0) {
            const participantesPorCodigo = {};

            resultado.participantes.forEach(participante => {
                participantesPorCodigo[participante.codigo] = participante;
            });

            resultado.documentos.forEach(doc => {
                if (doc.codPart && participantesPorCodigo[doc.codPart]) {
                    doc.participante = participantesPorCodigo[doc.codPart];
                }
            });
        }

        // Processa dados específicos para cada tipo de SPED
        switch (tipoSped) {
            case 'ecd':
                processarDadosContabeis(resultado);
                break;
            case 'ecf':
                processarDadosFiscais(resultado);
                break;
        }
    }
    
    function processarDadosContabeis(resultado) {
        // Processa contas do ativo circulante
        if (resultado.balancoPatrimonial && resultado.balancoPatrimonial.length > 0) {
            resultado.ativoCirculante = resultado.balancoPatrimonial.filter(conta => 
                conta.codigoConta.startsWith('1.1') && conta.naturezaSaldo === 'D'
            ).reduce((soma, conta) => soma + conta.saldoFinal, 0);

            resultado.passivoCirculante = resultado.balancoPatrimonial.filter(conta => 
                conta.codigoConta.startsWith('2.1') && conta.naturezaSaldo === 'C'
            ).reduce((soma, conta) => soma + conta.saldoFinal, 0);

            // Cálculo do capital de giro
            resultado.capitalGiro = resultado.ativoCirculante - resultado.passivoCirculante;

            // Identificação das contas de clientes, estoques e fornecedores
            resultado.saldoClientes = resultado.balancoPatrimonial.filter(conta => 
                (conta.codigoConta.startsWith('1.1.2') || 
                conta.descricaoConta.toLowerCase().includes('client')) && 
                conta.naturezaSaldo === 'D'
            ).reduce((soma, conta) => soma + conta.saldoFinal, 0);

            resultado.saldoEstoques = resultado.balancoPatrimonial.filter(conta => 
                (conta.codigoConta.startsWith('1.1.3') || 
                conta.descricaoConta.toLowerCase().includes('estoq')) && 
                conta.naturezaSaldo === 'D'
            ).reduce((soma, conta) => soma + conta.saldoFinal, 0);

            resultado.saldoFornecedores = resultado.balancoPatrimonial.filter(conta => 
                (conta.codigoConta.startsWith('2.1.1') || 
                conta.descricaoConta.toLowerCase().includes('fornece')) && 
                conta.naturezaSaldo === 'C'
            ).reduce((soma, conta) => soma + conta.saldoFinal, 0);
        }

        // Processa DRE
        if (resultado.demonstracaoResultado && resultado.demonstracaoResultado.length > 0) {
            resultado.receitaBruta = resultado.demonstracaoResultado.filter(conta => 
                conta.codigoConta.startsWith('3.1.1') && conta.naturezaSaldo === 'C'
            ).reduce((soma, conta) => soma + conta.saldoFinal, 0);

            resultado.receitaLiquida = resultado.demonstracaoResultado.filter(conta => 
                conta.codigoConta.startsWith('3.1') && conta.naturezaSaldo === 'C'
            ).reduce((soma, conta) => soma + conta.saldoFinal, 0);

            resultado.lucroBruto = resultado.demonstracaoResultado.filter(conta => 
                conta.codigoConta.startsWith('3.3') && conta.naturezaSaldo === 'C'
            ).reduce((soma, conta) => soma + conta.saldoFinal, 0);

            resultado.resultadoOperacional = resultado.demonstracaoResultado.filter(conta => 
                conta.codigoConta.startsWith('3.5') && conta.naturezaSaldo === 'C'
            ).reduce((soma, conta) => soma + conta.saldoFinal, 0);

            resultado.lucroLiquido = resultado.demonstracaoResultado.filter(conta => 
                conta.codigoConta.startsWith('3.11') && conta.naturezaSaldo === 'C'
            ).reduce((soma, conta) => soma + conta.saldoFinal, 0);
        }
    }

    function processarDadosFiscais(resultado) {
        // Processa incentivos fiscais
        if (resultado.incentivosFiscais && resultado.incentivosFiscais.length > 0) {
            resultado.valorTotalIncentivos = resultado.incentivosFiscais.reduce(
                (soma, incentivo) => soma + incentivo.valorIncentivo, 0
            );
        }

        // Processa alíquotas efetivas
        if (resultado.calculoImposto) {
            if (resultado.calculoImposto.irpj && resultado.dre && resultado.dre.lucro_liquido) {
                const baseIRPJ = resultado.calculoImposto.irpj.baseCalculoIRPJ;
                const valorIRPJ = resultado.calculoImposto.irpj.valorIRPJ + 
                                 (resultado.calculoImposto.irpj.valorAdicional || 0);

                resultado.aliquotaEfetivaIRPJ = baseIRPJ > 0 ? 
                    (valorIRPJ / baseIRPJ) : 0;
            }

            if (resultado.calculoImposto.csll && resultado.dre && resultado.dre.lucro_liquido) {
                const baseCSLL = resultado.calculoImposto.csll.baseCalculoCSLL;
                const valorCSLL = resultado.calculoImposto.csll.valorCSLL;

                resultado.aliquotaEfetivaCSLL = baseCSLL > 0 ? 
                    (valorCSLL / baseCSLL) : 0;
            }
        }

        // Processa dados de discriminação de receita
        if (resultado.discriminacaoReceita && resultado.discriminacaoReceita.length > 0) {
            const totalReceita = resultado.discriminacaoReceita.reduce(
                (soma, item) => soma + item.valorReceita, 0
            );

            const receitaExportacao = resultado.discriminacaoReceita.filter(
                item => item.isExportacao
            ).reduce((soma, item) => soma + item.valorReceita, 0);

            resultado.percentualExportacao = totalReceita > 0 ? 
                (receitaExportacao / totalReceita) : 0;
        }
    }

    /**
     * Determina o tipo de SPED com base nas primeiras linhas do arquivo
     * @param {Array} linhas - Linhas do arquivo SPED
     * @returns {string} Tipo do arquivo SPED
     */
    function determinarTipoSped(linhas) {
        for (let i = 0; i < Math.min(20, linhas.length); i++) {
            const linha = linhas[i];
            if (!linha.trim()) continue;

            const campos = linha.split('|');
            if (campos.length < 2) continue;

            const registro = campos[1];

            // Verifica registros específicos de cada tipo
            if (registro === '0000') {
                if (campos.length > 9) {
                    const finalidade = campos[9];
                    if (finalidade === '0') return 'fiscal';
                    if (finalidade === '1') return 'contribuicoes';
                }

                // Verifica se é ECF
                if (campos.length > 5 && campos[5] === 'ECF') {
                    return 'ecf';
                }

                // Verifica se é ECD
                if (campos.length > 5 && campos[5] === 'ECD') {
                    return 'ecd';
                }
            }
        }
        return null;
    }
    
    /**
     * Valida se um campo existe e retorna valor tratado
     * @param {Array} campos - Array de campos do registro
     * @param {number} indice - Índice do campo a ser validado
     * @param {string} valorPadrao - Valor padrão se campo não existir
     * @returns {string} Valor do campo ou valor padrão
     */
    function validarCampo(campos, indice, valorPadrao = '') {
        if (!campos || !Array.isArray(campos) || indice >= campos.length || campos[indice] === undefined) {
            return valorPadrao;
        }
        return campos[indice] || valorPadrao;
    }

    /**
     * Converte string monetária para número com validação
     * @param {string} valor - Valor em formato string
     * @returns {number} Valor convertido para número
     */
    function converterValorMonetario(valor) {
        if (!valor || typeof valor !== 'string') {
            return 0;
        }
        const valorLimpo = valor.replace(',', '.');
        const resultado = parseFloat(valorLimpo);
        return isNaN(resultado) ? 0 : resultado;
    }

    /**
     * Valida estrutura mínima de um registro SPED
     * @param {Array} campos - Array de campos do registro
     * @param {number} tamanhoMinimo - Número mínimo de campos esperados
     * @returns {boolean} True se estrutura é válida
     */
    function validarEstruturaRegistro(campos, tamanhoMinimo) {
        return campos && Array.isArray(campos) && campos.length >= tamanhoMinimo;
    }

    // Funções de parsing para cada tipo de registro

    function parseRegistro0000(campos) {
        // Garantir valores não nulos e realizar verificações de qualidade
        const cnpj = campos[7] || '';
        const nome = campos[8] || '';

        // Validação básica - CNPJ e Nome não podem ser vazios simultaneamente
        if (!cnpj && !nome) {
            console.warn('Registro 0000 com dados de empresa incompletos');
        }

        return {
            tipo: 'empresa',
            cnpj: cnpj,
            nome: nome, // Garantir que o nome seja extraído corretamente
            ie: campos[10] || '',
            municipio: campos[11] || '',
            uf: campos[12] || '',
            codMunicipio: campos[14] || ''
        };
    }

    function parseRegistro0000Contribuicoes(campos) {
        // Garantir valores não nulos e realizar verificações de qualidade
        const cnpj = campos[7] || '';
        const nome = campos[8] || '';

        return {
            tipo: 'empresa',
            cnpj: cnpj,
            nome: nome, // Garantir que o nome seja extraído corretamente
            ie: campos[10] || '',
            municipio: campos[11] || '',
            uf: campos[12] || '',
            regimeTributacao: campos[16] || ''
        };
    }

    function parseRegistroC100(campos) {
        if (!validarEstruturaRegistro(campos, 13)) {
            console.warn('Registro C100 com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'documento',
                indOper: validarCampo(campos, 2),
                indEmit: validarCampo(campos, 3),
                codPart: validarCampo(campos, 4),
                modelo: validarCampo(campos, 5),
                situacao: validarCampo(campos, 6),
                serie: validarCampo(campos, 7),
                numero: validarCampo(campos, 8),
                chaveNFe: validarCampo(campos, 9),
                dataEmissao: validarCampo(campos, 10),
                dataSaidaEntrada: validarCampo(campos, 11),
                valorTotal: converterValorMonetario(validarCampo(campos, 12, '0')),
                valorProdutos: converterValorMonetario(validarCampo(campos, 16, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro C100:', erro.message);
            return null;
        }
    }

    function parseRegistroC170(campos) {
        return {
            tipo: 'item',
            itemId: campos[3],
            descricao: campos[4],
            quantidade: parseFloat(campos[5].replace(',', '.')),
            unidade: campos[6],
            valorItem: parseFloat(campos[7].replace(',', '.')),
            valorDesconto: parseFloat(campos[8] ? campos[8].replace(',', '.') : '0'),
            cfop: campos[11],
            cstIcms: campos[10]
        };
    }

    function parseRegistroE110(campos) {
        if (!validarEstruturaRegistro(campos, 12)) {
            console.warn('Registro E110 com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'debito', // ALTERADO: era 'imposto'
                categoria: 'icms',
                valorTotalDebitos: converterValorMonetario(validarCampo(campos, 4, '0')),
                valorTotalCreditos: converterValorMonetario(validarCampo(campos, 5, '0')),
                valorSaldoApurado: converterValorMonetario(validarCampo(campos, 11, '0')),
                // Campos adicionais para melhor extração
                valorDebitosPeriodo: converterValorMonetario(validarCampo(campos, 6, '0')),
                valorCreditosPeriodo: converterValorMonetario(validarCampo(campos, 7, '0')),
                valorSaldoDevedor: converterValorMonetario(validarCampo(campos, 8, '0')),
                valorSaldoCredor: converterValorMonetario(validarCampo(campos, 9, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro E110:', erro.message);
            return null;
        }
    }
    
    function parseRegistroC190(campos) {
        return {
            tipo: 'item_analitico',
            categoria: 'icms',
            cfop: campos[3],
            cstIcms: campos[2],
            aliquotaIcms: parseFloat(campos[4].replace(',', '.')) || 0,
            valorOperacao: parseFloat(campos[5].replace(',', '.')) || 0,
            valorBaseCalculo: parseFloat(campos[6].replace(',', '.')) || 0,
            valorIcms: parseFloat(campos[7].replace(',', '.')) || 0
        };
    }

    function parseRegistroE111(campos) {
        return {
            tipo: 'ajuste',
            categoria: 'icms',
            codigoAjuste: campos[2],
            descricaoComplementar: campos[3],
            valorAjuste: parseFloat(campos[4].replace(',', '.')) || 0
        };
    }

    function parseRegistroC197(campos) {
        return {
            tipo: 'obrigacao',
            categoria: 'outros',
            codigoObrigacao: campos[2],
            valorObrigacao: parseFloat(campos[3].replace(',', '.')) || 0,
            dataVencimento: campos[4],
            codigoReceita: campos[5]
        };
    }

    function parseRegistroH010(campos) {
        return {
            tipo: 'inventario',
            codigoItem: campos[2],
            unidade: campos[3],
            quantidade: parseFloat(campos[4].replace(',', '.')) || 0,
            valorUnitario: parseFloat(campos[5].replace(',', '.')) || 0,
            valorItem: parseFloat(campos[6].replace(',', '.')) || 0
        };
    }

    function parseRegistro0150(campos) {
        return {
            tipo: 'participante',
            codigo: campos[2],
            nome: campos[3],
            cnpjCpf: campos[5] || campos[6],
            inscricaoEstadual: campos[7],
            codMunicipio: campos[8],
            suframa: campos[9],
            endereco: campos[10],
            numero: campos[11],
            complemento: campos[12],
            bairro: campos[13]
        };
    }

    function parseRegistroM100(campos) {
        return {
            tipo: 'credito',
            categoria: 'pis',
            codigoCredito: campos[2],
            valorBaseCreditoTotal: parseFloat(campos[4].replace(',', '.')),
            aliquotaPis: parseFloat(campos[5].replace(',', '.')),
            valorCredito: parseFloat(campos[6].replace(',', '.'))
        };
    }
    
    function parseRegistroM200(campos) {
        if (!validarEstruturaRegistro(campos, 14)) {
            console.warn('Registro M200 (PIS) com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'debito',
                categoria: 'pis',
                valorTotalContribuicao: converterValorMonetario(validarCampo(campos, 10, '0')),
                valorTotalRetencoes: converterValorMonetario(validarCampo(campos, 11, '0')),
                valorTotalDeducoes: converterValorMonetario(validarCampo(campos, 12, '0')),
                valorTotalPago: converterValorMonetario(validarCampo(campos, 13, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M200:', erro.message);
            return null;
        }
    }

    function parseRegistroM600(campos) {
        if (!validarEstruturaRegistro(campos, 14)) {
            console.warn('Registro M600 (COFINS) com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'debito',
                categoria: 'cofins',
                valorTotalContribuicao: converterValorMonetario(validarCampo(campos, 10, '0')),
                valorTotalRetencoes: converterValorMonetario(validarCampo(campos, 11, '0')),
                valorTotalDeducoes: converterValorMonetario(validarCampo(campos, 12, '0')),
                valorTotalPago: converterValorMonetario(validarCampo(campos, 13, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M600:', erro.message);
            return null;
        }
    }
    
    function parseRegistro0110(campos) {
        return {
            tipo: 'regime',
            categoria: 'pis_cofins',
            codigoIncidencia: campos[2], // 1=Escrituração de operações com incidência exclusivamente no regime não-cumulativo, 2=Escrituração de operações com incidência exclusivamente no regime cumulativo, 3=Escrituração de operações com incidência nos regimes não-cumulativo e cumulativo
            metodoCreditoRateado: campos[3]
        };
    }

    function parseRegistroM105(campos) {
        return {
            tipo: 'credito_detalhe',
            categoria: 'pis',
            codigoCredito: campos[2],
            baseCalculoCredito: parseFloat(campos[3].replace(',', '.')) || 0,
            aliquotaCredito: parseFloat(campos[4].replace(',', '.')) || 0,
            valorCredito: parseFloat(campos[5].replace(',', '.')) || 0
        };
    }

    function parseRegistroM500(campos) {
        return {
            tipo: 'credito',
            categoria: 'cofins',
            codigoCredito: campos[2],
            valorBaseCalculoTotal: parseFloat(campos[4].replace(',', '.')) || 0,
            aliquotaCofins: parseFloat(campos[5].replace(',', '.')) || 0,
            valorCredito: parseFloat(campos[6].replace(',', '.')) || 0
        };
    }

    function parseRegistroM505(campos) {
        return {
            tipo: 'credito_detalhe',
            categoria: 'cofins',
            codigoCredito: campos[2],
            baseCalculoCredito: parseFloat(campos[3].replace(',', '.')) || 0,
            aliquotaCredito: parseFloat(campos[4].replace(',', '.')) || 0,
            valorCredito: parseFloat(campos[5].replace(',', '.')) || 0
        };
    }

    function parseRegistroM400(campos) {
        return {
            tipo: 'receita_nao_tributada',
            categoria: 'pis',
            cstPis: campos[2],
            valorReceitaNaoTributada: parseFloat(campos[3].replace(',', '.')) || 0,
            codigoContaContabil: campos[4]
        };
    }

    function parseRegistroM800(campos) {
        return {
            tipo: 'receita_nao_tributada',
            categoria: 'cofins',
            cstCofins: campos[2],
            valorReceitaNaoTributada: parseFloat(campos[3].replace(',', '.')) || 0,
            codigoContaContabil: campos[4]
        };
    }
    
    function parseRegistro0000ECF(campos) {
        return {
            tipo: 'empresa',
            dataInicial: campos[6],
            dataFinal: campos[7],
            cnpj: campos[8],
            nome: campos[9],
            indicadorSituacaoInicial: campos[10],
            situacaoEspecial: campos[11]
        };
    }

    function parseRegistro0010ECF(campos) {
        return {
            tipo: 'parametros',
            categoria: 'ecf',
            formaApuracao: campos[2], // 1=Lucro Real, 2=Lucro Real/Arbitrado, 3=Lucro Presumido, 4=Lucro Presumido/Arbitrado, 5=Imune do IRPJ, 6=Isento do IRPJ, 7=Isento/Imune do IRPJ para Associação
            qualificacaoPJ: campos[3],
            formaTributacao: campos[4]
        };
    }

    function parseRegistroM010ECF(campos) {
        return {
            tipo: 'incentivo_fiscal',
            codIncentivo: campos[2],
            descricaoIncentivo: campos[3],
            valorIncentivo: parseFloat(campos[4].replace(',', '.')) || 0
        };
    }

    function parseRegistroN500ECF(campos) {
        if (campos[2] === '3.03') { // Lucro bruto
            return {
                tipo: 'dre',
                categoria: 'lucro_bruto',
                descricao: 'Lucro bruto',
                valor: parseFloat(campos[4].replace(',', '.')) || 0
            };
        } else if (campos[2] === '3.05') { // Resultado operacional
            return {
                tipo: 'dre',
                categoria: 'resultado_operacional',
                descricao: 'Resultado operacional',
                valor: parseFloat(campos[4].replace(',', '.')) || 0
            };
        } else if (campos[2] === '3.01') { // Receita líquida
            return {
                tipo: 'dre',
                categoria: 'receita_liquida',
                descricao: 'Receita líquida',
                valor: parseFloat(campos[4].replace(',', '.')) || 0
            };
        } else if (campos[2] === '3.11') { // Lucro líquido
            return {
                tipo: 'dre',
                categoria: 'lucro_liquido',
                descricao: 'Lucro líquido',
                valor: parseFloat(campos[4].replace(',', '.')) || 0
            };
        }
        return null;
    }

    function parseRegistroN660ECF(campos) {
        // Validar estrutura mínima do registro
        if (!validarEstruturaRegistro(campos, 6)) {
            console.warn('Registro N660 com estrutura insuficiente, campos disponíveis:', campos ? campos.length : 0);
            return null;
        }

        try {
            return {
                tipo: 'calculo_irpj',
                baseCalculoIRPJ: converterValorMonetario(validarCampo(campos, 5, '0')),
                aliquotaIRPJ: converterValorMonetario(validarCampo(campos, 6, '0')),
                valorIRPJ: converterValorMonetario(validarCampo(campos, 7, '0')),
                baseCalculoAdicional: converterValorMonetario(validarCampo(campos, 8, '0')),
                valorAdicional: converterValorMonetario(validarCampo(campos, 9, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro N660:', erro.message);
            return null;
        }
    }

    function parseRegistroN670ECF(campos) {
        // Validar estrutura mínima do registro
        if (!validarEstruturaRegistro(campos, 6)) {
            console.warn('Registro N670 com estrutura insuficiente, campos disponíveis:', campos ? campos.length : 0);
            return null;
        }

        try {
            return {
                tipo: 'calculo_csll',
                baseCalculoCSLL: converterValorMonetario(validarCampo(campos, 5, '0')),
                aliquotaCSLL: converterValorMonetario(validarCampo(campos, 6, '0')),
                valorCSLL: converterValorMonetario(validarCampo(campos, 7, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro N670:', erro.message);
            return null;
        }
    }

    function parseRegistroY540ECF(campos) {
        return {
            tipo: 'discriminacao_receita',
            tipoReceita: campos[2],
            valorReceita: parseFloat(campos[3].replace(',', '.')) || 0,
            isExportacao: campos[2] === '04' // Código 04 = Exportação de mercadorias e serviços
        };
    }
    
    function parseRegistro0000ECD(campos) {
        return {
            tipo: 'empresa',
            dataInicial: campos[6],
            dataFinal: campos[7],
            cnpj: campos[8],
            nome: campos[9],
            indicadorSituacaoEspecial: campos[17]
        };
    }

    function parseRegistroI200ECD(campos) {
        return {
            tipo: 'lancamento_contabil',
            numeroLancamento: campos[2],
            dataLancamento: campos[3],
            valorLancamento: parseFloat(campos[5].replace(',', '.')) || 0
        };
    }

    function parseRegistroI250ECD(campos) {
        return {
            tipo: 'partida_lancamento',
            codigoConta: campos[2],
            codigoCentroCusto: campos[3],
            valorPartida: parseFloat(campos[4].replace(',', '.')) || 0,
            naturezaPartida: campos[5], // D=Débito, C=Crédito
            historico: campos[6]
        };
    }

    function parseRegistroJ100ECD(campos) {
        return {
            tipo: 'balanco_patrimonial',
            codigoConta: campos[2],
            descricaoConta: campos[3],
            saldoInicial: parseFloat(campos[4].replace(',', '.')) || 0,
            debitosPeriodo: parseFloat(campos[5].replace(',', '.')) || 0,
            creditosPeriodo: parseFloat(campos[6].replace(',', '.')) || 0,
            saldoFinal: parseFloat(campos[7].replace(',', '.')) || 0,
            naturezaSaldo: campos[8] // D=Devedor, C=Credor
        };
    }

    function parseRegistroJ150ECD(campos) {
        return {
            tipo: 'demonstracao_resultado',
            codigoConta: campos[2],
            descricaoConta: campos[3],
            saldoInicial: parseFloat(campos[4].replace(',', '.')) || 0,
            debitosPeriodo: parseFloat(campos[5].replace(',', '.')) || 0,
            creditosPeriodo: parseFloat(campos[6].replace(',', '.')) || 0,
            saldoFinal: parseFloat(campos[7].replace(',', '.')) || 0,
            naturezaSaldo: campos[8] // D=Devedor, C=Credor
        };
    }
    
    // Registro E200 - Apuração do IPI
    function parseRegistroE200(campos) {
        if (!validarEstruturaRegistro(campos, 10)) {
            console.warn('Registro E200 com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'imposto',
                categoria: 'ipi',
                valorTotalDebitos: converterValorMonetario(validarCampo(campos, 4, '0')),
                valorTotalCreditos: converterValorMonetario(validarCampo(campos, 5, '0')),
                valorAPagar: converterValorMonetario(validarCampo(campos, 8, '0')),
                saldoCredorAnterior: converterValorMonetario(validarCampo(campos, 6, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro E200:', erro.message);
            return null;
        }
    }

    // Registro E210 - Ajuste da Apuração do IPI
    function parseRegistroE210(campos) {
        if (!validarEstruturaRegistro(campos, 5)) {
            console.warn('Registro E210 com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'ajuste',
                categoria: 'ipi',
                codigoAjuste: validarCampo(campos, 3),
                descricaoComplementar: validarCampo(campos, 4),
                valorAjuste: converterValorMonetario(validarCampo(campos, 5, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro E210:', erro.message);
            return null;
        }
    }

    // Registro M205 - Ajustes da Consolidação da Contribuição PIS
    function parseRegistroM205(campos) {
        if (!validarEstruturaRegistro(campos, 8)) {
            console.warn('Registro M205 com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'ajuste_consolidacao',
                categoria: 'pis',
                codigoAjuste: validarCampo(campos, 3),
                valorAjuste: converterValorMonetario(validarCampo(campos, 4, '0')),
                codigoReceita: validarCampo(campos, 5),
                indicadorNatureza: validarCampo(campos, 6), // 0=Redutor, 1=Acréscimo
                valorDeducao: converterValorMonetario(validarCampo(campos, 7, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M205:', erro.message);
            return null;
        }
    }

    // Registro M210 - Detalhamento da Consolidação da Contribuição PIS
    function parseRegistroM210(campos) {
        if (!validarEstruturaRegistro(campos, 8)) {
            console.warn('Registro M210 com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'detalhamento_consolidacao',
                categoria: 'pis',
                codigoReceita: validarCampo(campos, 3),
                valorContribuicao: converterValorMonetario(validarCampo(campos, 4, '0')),
                valorMulta: converterValorMonetario(validarCampo(campos, 5, '0')),
                valorJuros: converterValorMonetario(validarCampo(campos, 6, '0')),
                dataVencimento: validarCampo(campos, 7)
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M210:', erro.message);
            return null;
        }
    }

    // Registro M605 - Ajustes da Consolidação da Contribuição COFINS
    function parseRegistroM605(campos) {
        if (!validarEstruturaRegistro(campos, 8)) {
            console.warn('Registro M605 com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'ajuste_consolidacao',
                categoria: 'cofins',
                codigoAjuste: validarCampo(campos, 3),
                valorAjuste: converterValorMonetario(validarCampo(campos, 4, '0')),
                codigoReceita: validarCampo(campos, 5),
                indicadorNatureza: validarCampo(campos, 6), // 0=Redutor, 1=Acréscimo
                valorDeducao: converterValorMonetario(validarCampo(campos, 7, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M605:', erro.message);
            return null;
        }
    }

    // Registro M610 - Detalhamento da Consolidação da Contribuição COFINS
    function parseRegistroM610(campos) {
        if (!validarEstruturaRegistro(campos, 8)) {
            console.warn('Registro M610 com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'detalhamento_consolidacao',
                categoria: 'cofins',
                codigoReceita: validarCampo(campos, 3),
                valorContribuicao: converterValorMonetario(validarCampo(campos, 4, '0')),
                valorMulta: converterValorMonetario(validarCampo(campos, 5, '0')),
                valorJuros: converterValorMonetario(validarCampo(campos, 6, '0')),
                dataVencimento: validarCampo(campos, 7)
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M610:', erro.message);
            return null;
        }
    }

    // Registro 1001 - Registro de Encerramento
    function parseRegistro1001(campos) {
        try {
            return {
                tipo: 'encerramento',
                indicadorMovimento: validarCampo(campos, 2), // 0=Bloco sem dados, 1=Bloco com dados
                valorTotalCreditos: converterValorMonetario(validarCampo(campos, 3, '0')),
                valorTotalDebitos: converterValorMonetario(validarCampo(campos, 4, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro 1001:', erro.message);
            return null;
        }
    }

    // Registro 1100 - Totalização das Contribuições PIS
    function parseRegistro1100(campos) {
        if (!validarEstruturaRegistro(campos, 10)) {
            console.warn('Registro 1100 com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'totalizacao',
                categoria: 'pis',
                valorContribuicaoAPagar: converterValorMonetario(validarCampo(campos, 3, '0')),
                valorCredutoCompensado: converterValorMonetario(validarCampo(campos, 4, '0')),
                valorContribuicaoPaga: converterValorMonetario(validarCampo(campos, 5, '0')),
                saldoCredorPeriodo: converterValorMonetario(validarCampo(campos, 6, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro 1100:', erro.message);
            return null;
        }
    }

    // Registro 1500 - Totalização das Contribuições COFINS
    function parseRegistro1500(campos) {
        if (!validarEstruturaRegistro(campos, 10)) {
            console.warn('Registro 1500 com estrutura insuficiente');
            return null;
        }

        try {
            return {
                tipo: 'totalizacao',
                categoria: 'cofins',
                valorContribuicaoAPagar: converterValorMonetario(validarCampo(campos, 3, '0')),
                valorCredutoCompensado: converterValorMonetario(validarCampo(campos, 4, '0')),
                valorContribuicaoPaga: converterValorMonetario(validarCampo(campos, 5, '0')),
                saldoCredorPeriodo: converterValorMonetario(validarCampo(campos, 6, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro 1500:', erro.message);
            return null;
        }
    }

    /**
     * Integra dados extraídos ao resultado
     */
    function integrarDados(resultado, dados, tipoRegistro) {
        if (!dados || !dados.tipo) {
            console.warn(`Dados inválidos para integração do registro ${tipoRegistro}`);
            return;
        }

        try {
            switch (dados.tipo) {
                case 'empresa':
                    // Validar e normalizar dados da empresa
                    if (dados.nome || dados.cnpj) {
                        resultado.empresa = {...resultado.empresa, ...dados};
                    }
                    break;

                case 'documento':
                    if (dados.indOper !== undefined) {
                        resultado.documentos.push(dados);
                    }
                    break;

                case 'item':
                    if (dados.itemId || dados.descricao) {
                        resultado.itens.push(dados);
                    }
                    break;

                case 'item_analitico':
                    if (!resultado.itensAnaliticos) resultado.itensAnaliticos = [];
                    resultado.itensAnaliticos.push(dados);
                    break;

                case 'ajuste':
                    if (!resultado.ajustes) resultado.ajustes = {};
                    if (!resultado.ajustes[dados.categoria]) resultado.ajustes[dados.categoria] = [];
                    resultado.ajustes[dados.categoria].push(dados);
                    break;

                case 'debito':
                if (!resultado.debitos) resultado.debitos = {};
                if (!resultado.debitos[dados.categoria]) {
                    resultado.debitos[dados.categoria] = [];
                }
                resultado.debitos[dados.categoria].push(dados);
                break;

            case 'imposto':
                // ALTERADO: Verificar se é um débito disfarçado
                if (dados.categoria === 'icms' && dados.valorTotalDebitos !== undefined) {
                    // Tratar como débito para compatibilidade
                    if (!resultado.debitos) resultado.debitos = {};
                    if (!resultado.debitos[dados.categoria]) {
                        resultado.debitos[dados.categoria] = [];
                    }
                    resultado.debitos[dados.categoria].push({
                        ...dados,
                        tipo: 'debito'
                    });
                } else {
                    // Tratamento original para outros impostos
                    if (!resultado.impostos[dados.categoria]) {
                        resultado.impostos[dados.categoria] = [];
                    }
                    resultado.impostos[dados.categoria].push(dados);
                }
                break;

                case 'credito':
                case 'credito_detalhe':
                    if (!resultado.creditos[dados.categoria]) {
                        resultado.creditos[dados.categoria] = [];
                    }
                    resultado.creditos[dados.categoria].push(dados);
                    break;

                case 'receita_nao_tributada':
                    if (!resultado.receitasNaoTributadas) resultado.receitasNaoTributadas = {};
                    if (!resultado.receitasNaoTributadas[dados.categoria]) {
                        resultado.receitasNaoTributadas[dados.categoria] = [];
                    }
                    resultado.receitasNaoTributadas[dados.categoria].push(dados);
                    break;

                case 'regime':
                    if (!resultado.regimes) resultado.regimes = {};
                    resultado.regimes[dados.categoria] = dados;
                    break;

                case 'inventario':
                    if (!resultado.inventario) resultado.inventario = [];
                    resultado.inventario.push(dados);
                    break;

                case 'participante':
                    if (!resultado.participantes) resultado.participantes = [];
                    resultado.participantes.push(dados);
                    break;

                case 'incentivo_fiscal':
                    if (!resultado.incentivosFiscais) resultado.incentivosFiscais = [];
                    resultado.incentivosFiscais.push(dados);
                    break;

                case 'dre':
                    if (!resultado.dre) resultado.dre = {};
                    resultado.dre[dados.categoria] = dados;
                    break;

                case 'calculo_irpj':
                    if (!resultado.calculoImposto) resultado.calculoImposto = {};
                    resultado.calculoImposto.irpj = dados;
                    break;

                case 'calculo_csll':
                    if (!resultado.calculoImposto) resultado.calculoImposto = {};
                    resultado.calculoImposto.csll = dados;
                    break;

                case 'discriminacao_receita':
                    if (!resultado.discriminacaoReceita) resultado.discriminacaoReceita = [];
                    resultado.discriminacaoReceita.push(dados);
                    break;

                case 'lancamento_contabil':
                    if (!resultado.lancamentosContabeis) resultado.lancamentosContabeis = [];
                    resultado.lancamentosContabeis.push(dados);
                    break;

                case 'partida_lancamento':
                    if (!resultado.partidasLancamento) resultado.partidasLancamento = [];
                    resultado.partidasLancamento.push(dados);
                    break;

                case 'balanco_patrimonial':
                    if (!resultado.balancoPatrimonial) resultado.balancoPatrimonial = [];
                    resultado.balancoPatrimonial.push(dados);
                    break;

                case 'demonstracao_resultado':
                    if (!resultado.demonstracaoResultado) resultado.demonstracaoResultado = [];
                    resultado.demonstracaoResultado.push(dados);
                    break;

                default:
                    console.warn(`Tipo de dados não reconhecido para integração: ${dados.tipo}`);
            }
        } catch (erro) {
            console.error(`Erro ao integrar dados do tipo ${dados.tipo}:`, erro.message);
        }
    }

    // Interface pública
    return {
        processarArquivo,
        tiposSuportados: Object.keys(registrosMapeados)
    };
})();