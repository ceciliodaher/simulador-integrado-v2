/**
 * SpedParser - Módulo corrigido e completo para processamento de arquivos SPED
 * Responsável por ler e analisar arquivos SPED de diferentes tipos
 * VERSÃO CORRIGIDA E COMPLETA - Janeiro 2025
 */

function parseValorMonetario(valorString) {
    // Verificar se valor é válido
    if (!valorString || valorString === '' || valorString === '0' || valorString === 'null') {
        return 0;
    }
    
    try {
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
        console.warn('Erro ao converter valor monetário:', valorString, erro);
        return 0;
    }
}

const SpedParser = (function() {
    // Mapeamento completo de registros por tipo de SPED
    const registrosMapeados = {
        fiscal: {
            // Registros de abertura e identificação
            '0000': parseRegistro0000,
            '0001': parseRegistro0001,
            '0005': parseRegistro0005,
            '0150': parseRegistro0150,  // Participantes
            '0190': parseRegistro0190,  // Unidades de medida
            '0200': parseRegistro0200,  // Itens
            
            // Registros de documentos fiscais - BLOCO C
            'C100': parseRegistroC100,  // Nota fiscal
            'C170': parseRegistroC170,  // Itens da nota
            'C190': parseRegistroC190,  // Registro analítico ICMS
            'C197': parseRegistroC197,  // Outras obrigações
            
            // Registros de apuração ICMS - BLOCO E
            'E110': parseRegistroE110,  // Apuração ICMS
            'E111': parseRegistroE111,  // Ajustes ICMS
            'E116': parseRegistroE116,  // Obrigações ICMS
            
            // Registros de apuração IPI - BLOCO E
            'E200': parseRegistroE200,  // Apuração IPI
            'E210': parseRegistroE210,  // Ajustes IPI
            'E220': parseRegistroE220,  // Outras informações IPI
            
            // Registros de inventário - BLOCO H
            'H010': parseRegistroH010,  // Inventário
            'H020': parseRegistroH020,  // Informações do estoque
            'K100': parseRegistroK100Fiscal,
            
            // Registros de controle e encerramento
            '9900': parseRegistro9900,
            '9990': parseRegistro9990,
            '9999': parseRegistro9999
        },
        
        contribuicoes: {
            // Registros de abertura
            '0000': parseRegistro0000Contribuicoes,
            '0001': parseRegistro0001Contribuicoes,
            '0110': parseRegistro0110,  // Regime PIS/COFINS
            '0140': parseRegistro0140,  // Tabela de cadastro de participantes
            '0150': parseRegistro0150Contribuicoes,  // Dados dos participantes
            
            // BLOCO A - Receitas
            'A100': parseRegistroA100,  // Receitas
            'A110': parseRegistroA110,  // Complemento da receita
            'A111': parseRegistroA111,  // Processo referenciado
            
            // BLOCO C - Créditos
            'C100': parseRegistroC100Contribuicoes,  // Documentos/operações
            'C180': parseRegistroC180,  // Consolidação operações
            'C181': parseRegistroC181,  // Detalhamento consolidação
            'C185': parseRegistroC185,  // Detalhamento da consolidação - PIS
            'C188': parseRegistroC188,  // Processo referenciado
            
            // BLOCO D - Créditos de bens do ativo imobilizado
            'D100': parseRegistroD100,  // Aquisição de serviços
            'D101': parseRegistroD101,  // Detalhamento crédito PIS
            'D105': parseRegistroD105,  // Detalhamento crédito COFINS
            'D111': parseRegistroD111,  // Processo referenciado
            
            // BLOCO F - Demais documentos
            'F100': parseRegistroF100,  // Demais documentos
            'F111': parseRegistroF111,  // Processo referenciado
            'F120': parseRegistroF120,  // Bens incorporados ao ativo
            'F129': parseRegistroF129,  // Processo referenciado
            'F130': parseRegistroF130,  // Operações da atividade imobiliária
            'F139': parseRegistroF139,  // Processo referenciado
            'F150': parseRegistroF150,  // Crédito presumido sobre estoque
            'F200': parseRegistroF200,  // Operações da atividade imobiliária
            'F205': parseRegistroF205,  // Operações com cartão de crédito
            'F210': parseRegistroF210,  // Cide
            'F211': parseRegistroF211,  // Processo referenciado
            
            // BLOCO I - Operações com exterior
            'I100': parseRegistroI100,  // Operações com exterior
            'I199': parseRegistroI199,  // Processo referenciado
            
            // BLOCO M - Apuração contribuições sociais
            'M100': parseRegistroM100,  // Crédito PIS
            'M105': parseRegistroM105,  // Detalhamento crédito PIS
            'M110': parseRegistroM110,  // Ajustes crédito PIS
            'M115': parseRegistroM115,  // Detalhamento ajustes crédito PIS
            'M200': parseRegistroM200,  // Consolidação contribuição PIS
            'M205': parseRegistroM205,  // Ajustes consolidação PIS
            'M210': parseRegistroM210,  // Detalhamento consolidação PIS
            'M215': parseRegistroM215, // NOVO - Detalhamento ajustes BC PIS
            'M220': parseRegistroM220,  // Demonstrativo de saldo credor PIS
            'M225': parseRegistroM225,  // Detalhamento demonstrativo PIS
            'M400': parseRegistroM400,  // Receita não tributada PIS
            'M410': parseRegistroM410,  // Detalhamento receita não tributada PIS
            
            // Registros COFINS
            'M500': parseRegistroM500,  // Crédito COFINS
            'M505': parseRegistroM505,  // Detalhamento crédito COFINS
            'M510': parseRegistroM510,  // Ajustes crédito COFINS
            'M515': parseRegistroM515,  // Detalhamento ajustes crédito COFINS
            'M600': parseRegistroM600,  // Consolidação contribuição COFINS
            'M605': parseRegistroM605,  // Ajustes consolidação COFINS
            'M610': parseRegistroM610,  // Detalhamento consolidação COFINS
            'M620': parseRegistroM620,  // Demonstrativo de saldo credor COFINS
            'M625': parseRegistroM625,  // Detalhamento demonstrativo COFINS
            'M800': parseRegistroM800,  // Receita não tributada COFINS
            'M810': parseRegistroM810,  // Detalhamento receita não tributada COFINS
            'M615': parseRegistroM615, // NOVO - Detalhamento ajustes BC COFINS
            
            // BLOCO P - Apuração da contribuição previdenciária
            'P100': parseRegistroP100,  // Contribuição previdenciária
            'P110': parseRegistroP110,  // Ajustes contribuição previdenciária
            'P199': parseRegistroP199,  // Processo referenciado
            'P200': parseRegistroP200,  // Consolidação contribuição previdenciária
            'P210': parseRegistroP210,  // Ajustes consolidação previdenciária
            
            // Registros de controle e totalização
            '1001': parseRegistro1001,  // Registro de encerramento
            '1100': parseRegistro1100,  // Totalização PIS
            '1200': parseRegistro1200,  // Totalização COFINS
            '1300': parseRegistro1300,  // Totalização contribuição previdenciária
            '1500': parseRegistro1500   // Totalização geral
        },
        
        ecf: {
            '0000': parseRegistro0000ECF,
            '0010': parseRegistro0010ECF,
            '0020': parseRegistro0020ECF,
            'J001': parseRegistroJ001ECF,
            'J050': parseRegistroJ050ECF,
            'J051': parseRegistroJ051ECF,
            'J100': parseRegistroJ100ECF,
            'K001': parseRegistroK001ECF,
            'K030': parseRegistroK030ECF,
            'K155': parseRegistroK155ECF,
            'K156': parseRegistroK156ECF,
            'L001': parseRegistroL001ECF,
            'L030': parseRegistroL030ECF,
            'L100': parseRegistroL100ECF,
            'M001': parseRegistroM001ECF,
            'M010': parseRegistroM010ECF,
            'M300': parseRegistroM300ECF,
            'M350': parseRegistroM350ECF,
            'N001': parseRegistroN001ECF,
            'N500': parseRegistroN500ECF,
            'N600': parseRegistroN600ECF,
            'N610': parseRegistroN610ECF,
            'N620': parseRegistroN620ECF,
            'N630': parseRegistroN630ECF,
            'N650': parseRegistroN650ECF,
            'N660': parseRegistroN660ECF,
            'N670': parseRegistroN670ECF,
            'P001': parseRegistroP001ECF,
            'P030': parseRegistroP030ECF,
            'P100': parseRegistroP100ECF,
            'P130': parseRegistroP130ECF,
            'P150': parseRegistroP150ECF,
            'P200': parseRegistroP200ECF,
            'P230': parseRegistroP230ECF,
            'T001': parseRegistroT001ECF,
            'T030': parseRegistroT030ECF,
            'T120': parseRegistroT120ECF,
            'T150': parseRegistroT150ECF,
            'U001': parseRegistroU001ECF,
            'U030': parseRegistroU030ECF,
            'U100': parseRegistroU100ECF,
            'Y540': parseRegistroY540ECF
        },
        
        ecd: {
            '0000': parseRegistro0000ECD,
            '0001': parseRegistro0001ECD,
            '0007': parseRegistro0007ECD,
            '0020': parseRegistro0020ECD,
            'I001': parseRegistroI001ECD,
            'I010': parseRegistroI010ECD,
            'I012': parseRegistroI012ECD,
            'I015': parseRegistroI015ECD,
            'I020': parseRegistroI020ECD,
            'I030': parseRegistroI030ECD,
            'I050': parseRegistroI050ECD,
            'I051': parseRegistroI051ECD,
            'I052': parseRegistroI052ECD,
            'I053': parseRegistroI053ECD,
            'I100': parseRegistroI100ECD,
            'I150': parseRegistroI150ECD,
            'I155': parseRegistroI155ECD,
            'I200': parseRegistroI200ECD,
            'I250': parseRegistroI250ECD,
            'I300': parseRegistroI300ECD,
            'I310': parseRegistroI310ECD,
            'I350': parseRegistroI350ECD,
            'I355': parseRegistroI355ECD,
            'J001': parseRegistroJ001ECD,
            'J005': parseRegistroJ005ECD,
            'J100': parseRegistroJ100ECD,
            'J150': parseRegistroJ150ECD,
            'K001': parseRegistroK001ECD,
            'K030': parseRegistroK030ECD,
            'K100': parseRegistroK100ECD,
            'K155': parseRegistroK155ECD,
            'K156': parseRegistroK156ECD,
            'K200': parseRegistroK200ECD,
            'K220': parseRegistroK220ECD,
            'K230': parseRegistroK230ECD,
            'K300': parseRegistroK300ECD,
            
            // Atualização do mapeamento de registros
            '9900': parseRegistro9900,
            '9990': parseRegistro9990,
            '9999': parseRegistro9999,

            'J050': parseRegistroJ050ECF,
            'L100': parseRegistroL100ECF,        
            'M105': parseRegistroM105,
            'M505': parseRegistroM505,
        }
    };

    /**
     * Processa um arquivo SPED e extrai os dados relevantes
     */
    function processarArquivo(arquivo, tipo) {
        return new Promise((resolve, reject) => {
            try {
                // Inicializar o FileReader corretamente
                const reader = new FileReader();

                // Configurar o manipulador de evento para quando o arquivo for carregado
                reader.onload = function(e) {
                    try {
                        // Extrair o conteúdo do resultado do leitor
                        const conteudo = e.target.result;

                        // Dividir o conteúdo em linhas
                        const linhas = conteudo.split('\n');

                        // Determinar o tipo de SPED com base no conteúdo, se não foi especificado
                        const tipoEfetivo = tipo || determinarTipoSped(linhas, arquivo.name);

                        // Extrair dados das linhas
                        const dadosExtraidos = extrairDados(linhas, tipoEfetivo);

                        // Adicionar metadados do arquivo
                        dadosExtraidos.metadados = {
                            ...(dadosExtraidos.metadados || {}),
                            nomeArquivo: arquivo.name,
                            tamanhoBytes: arquivo.size,
                            tipoArquivo: tipoEfetivo,
                            dataProcessamento: new Date().toISOString()
                        };

                        // Adicionar cálculo de ciclos após processamento
                        const ciclos = calcularCiclosFinanceiros(dadosExtraidos);
                        if (ciclos) {
                            dadosExtraidos.ciclosFinanceiros = ciclos;
                        }

                        resolve(dadosExtraidos);
                    } catch (erro) {
                        console.error('SPED-PARSER: Erro ao processar conteúdo do arquivo:', erro);
                        reject(erro);
                    }
                };

                // Configurar o manipulador de erro
                reader.onerror = function(e) {
                    console.error('SPED-PARSER: Erro na leitura do arquivo:', e.target.error);
                    reject(new Error('Erro ao ler o arquivo: ' + e.target.error));
                };

                // Iniciar a leitura do arquivo como texto
                reader.readAsText(arquivo);

            } catch (erro) {
                console.error('SPED-PARSER: Erro ao configurar leitor de arquivo:', erro);
                reject(erro);
            }
        });
    }
    
    function processarDadosTributarios(dadosSped) {
        console.log('Processando dados tributários...');

        const tributarios = {
            debitos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
            creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
            aproveitamentoPIS: 100,
            aproveitamentoCOFINS: 100,
            aliquotaICMS: 18
        };

        if (!dadosSped.contribuicoes) return tributarios;

        // Processar SPED Contribuições
        for (const linha of dadosSped.contribuicoes) {
            const campos = linha.split('|');
            const registro = campos[1];

            switch (registro) {
                case 'M100': // DÉBITOS PIS estão no campo 3 do M100
                    const debitosPIS = parseFloat(campos[3]?.replace(',', '.') || 0);
                    tributarios.debitos.pis = debitosPIS;
                    console.log(`PIS Débitos M100: R$ ${debitosPIS.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
                    break;

                case 'M500': // DÉBITOS COFINS estão no campo 3 do M500
                    const debitosCOFINS = parseFloat(campos[3]?.replace(',', '.') || 0);
                    tributarios.debitos.cofins = debitosCOFINS;
                    console.log(`COFINS Débitos M500: R$ ${debitosCOFINS.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
                    break;

                case 'M105': // Créditos PIS
                    const creditoPIS = parseFloat(campos[5]?.replace(',', '.') || 0);
                    tributarios.creditos.pis += creditoPIS;
                    break;

                case 'M505': // Créditos COFINS  
                    const creditoCOFINS = parseFloat(campos[5]?.replace(',', '.') || 0);
                    tributarios.creditos.cofins += creditoCOFINS;
                    break;
            }
        }

        // Se não encontrou M500, estimar COFINS baseado no PIS (proporção 7,6/1,65)
        if (tributarios.debitos.cofins === 0 && tributarios.debitos.pis > 0) {
            tributarios.debitos.cofins = tributarios.debitos.pis * (7.6 / 1.65);
            console.log(`COFINS estimado: R$ ${tributarios.debitos.cofins.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        }

        // Calcular percentuais de aproveitamento
        if (tributarios.debitos.pis > 0) {
            tributarios.aproveitamentoPIS = Math.min((tributarios.creditos.pis / tributarios.debitos.pis) * 100, 100);
        }

        if (tributarios.debitos.cofins > 0) {
            tributarios.aproveitamentoCOFINS = Math.min((tributarios.creditos.cofins / tributarios.debitos.cofins) * 100, 100);
        }

        console.log(`PIS: Débito R$ ${tributarios.debitos.pis.toLocaleString('pt-BR', {minimumFractionDigits: 2})}, Crédito R$ ${tributarios.creditos.pis.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        console.log(`COFINS: Débito R$ ${tributarios.debitos.cofins.toLocaleString('pt-BR', {minimumFractionDigits: 2})}, Crédito R$ ${tributarios.creditos.cofins.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

        return tributarios;
    }

    /**
     * Extrai dados relevantes das linhas do arquivo SPED
     */
    function extrairDados(linhas, tipo) {
        const resultado = {
            empresa: {},
            documentos: [],
            itens: [],
            itensAnaliticos: [],
            impostos: {},
            creditos: {},
            debitos: {},
            regimes: {},
            ajustes: {},
            receitasNaoTributadas: {},
            balancoPatrimonial: [],
            demonstracaoResultado: [],
            lancamentosContabeis: [],
            partidasLancamento: [],
            calculoImposto: {},
            incentivosFiscais: [],
            participantes: [],
            inventario: [],
            discriminacaoReceita: [],
            totalizacao: {},
            detalhamento: {},
            metadados: {
                tipo: tipo,
                timestamp: new Date().toISOString(),
                registrosProcessados: 0,
                registrosIgnorados: 0,
                erros: []
            }
        };

        let tipoSped = tipo || determinarTipoSped(linhas);
        
        if (!tipoSped || !registrosMapeados[tipoSped]) {
            console.warn(`SPED-PARSER: Tipo não reconhecido: ${tipoSped}. Usando 'fiscal' como padrão.`);
            tipoSped = 'fiscal';
        }

        resultado.metadados.tipoDetectado = tipoSped;

        let linhaBemSucedida = 0;
        
        for (let i = 0; i < linhas.length; i++) {
            const linha = linhas[i];
            
            if (!linha.trim()) continue;

            try {
                const campos = linha.split('|');
                
                if (campos.length < 2) {
                    resultado.metadados.registrosIgnorados++;
                    continue;
                }
                
                const registro = campos[1];

                if (registrosMapeados[tipoSped] && registrosMapeados[tipoSped][registro]) {
                    try {
                        const dadosRegistro = registrosMapeados[tipoSped][registro](campos);
                        
                        if (dadosRegistro && dadosRegistro !== null) {
                            integrarDados(resultado, dadosRegistro, registro);
                            linhaBemSucedida++;
                            resultado.metadados.registrosProcessados++;
                        }
                    } catch (erroRegistro) {
                        const mensagemErro = `Erro no registro ${registro} (linha ${i + 1}): ${erroRegistro.message}`;
                        resultado.metadados.erros.push(mensagemErro);
                        console.warn('SPED-PARSER:', mensagemErro);
                    }
                } else {
                    resultado.metadados.registrosIgnorados++;
                }
            } catch (erroLinha) {
                const mensagemErro = `Erro na linha ${i + 1}: ${erroLinha.message}`;
                resultado.metadados.erros.push(mensagemErro);
                console.warn('SPED-PARSER:', mensagemErro);
            }
        }

        console.log(`SPED-PARSER: Processamento concluído para ${tipoSped}:`, {
            totalLinhas: linhas.length,
            registrosProcessados: resultado.metadados.registrosProcessados,
            registrosIgnorados: resultado.metadados.registrosIgnorados,
            erros: resultado.metadados.erros.length,
            linhaBemSucedida: linhaBemSucedida
        });

        processarRelacoesEntreDados(resultado, tipoSped);

        return resultado;
    }
    
    /**
     * Extrai um registro específico de um conjunto de linhas
     * @param {Array} linhas - Linhas do arquivo SPED
     * @param {string} codigoRegistro - Código do registro a ser extraído (ex: 'E110', 'M200')
     * @returns {Array} - Array com as linhas do registro específico
     */
    function extrairRegistroEspecifico(linhas, codigoRegistro) {
        if (!linhas || !Array.isArray(linhas) || linhas.length === 0) {
            console.warn(`SPED-PARSER: Nenhuma linha disponível para extrair registro ${codigoRegistro}`);
            return [];
        }

        const registrosEncontrados = [];
        for (const linha of linhas) {
            if (!linha.trim()) continue;
            try {
                const campos = linha.split('|');
                if (campos.length < 2) continue;
                const registro = campos[1];
                if (registro === codigoRegistro) {
                    registrosEncontrados.push(campos);
                    console.log(`SPED-PARSER: Registro ${codigoRegistro} encontrado`);
                }
            } catch (erro) {
                console.warn(`SPED-PARSER: Erro ao processar linha para extração de ${codigoRegistro}:`, erro.message);
            }
        }
        console.log(`SPED-PARSER: Total de registros ${codigoRegistro} encontrados: ${registrosEncontrados.length}`);
        return registrosEncontrados;
    }


    // =============================
    // FUNÇÕES UTILITÁRIAS
    // =============================

    /**
     * Valida se o registro tem o número mínimo de campos e estrutura esperada
     * @param {Array} campos - Array de campos do registro
     * @param {number} minCampos - Número mínimo de campos esperados
     * @returns {boolean} - Verdadeiro se o registro tem a estrutura válida
     */
    function validarEstruturaRegistro(campos, minCampos) {
        if (!Array.isArray(campos)) {
            console.warn('SPED-PARSER: Campos não é um array');
            return false;
        }

        if (campos.length < minCampos) {
            console.warn(`SPED-PARSER: Registro com número insuficiente de campos: ${campos.length} (esperado >= ${minCampos})`);
            return false;
        }

        // Verificar se o primeiro campo é um pipe (estrutura de SPED)
        if (campos[0] !== '') {
            console.warn('SPED-PARSER: Estrutura de registro inválida - primeiro campo deve ser vazio');
            return false;
        }

        return true;
    }

    /**
     * Valida e retorna um campo do registro
     */
    function validarCampo(campos, indice, valorPadrao = '') {
        if (!Array.isArray(campos) || indice >= campos.length) {
            return valorPadrao;
        }
        return campos[indice] ? campos[indice].trim() : valorPadrao;
    }

    /**
     * Converte string para valor monetário
     */
    // function converterValorMonetario(valor) { // Replaced by parseValorMonetario
    //     if (!valor || valor === '') return 0;
        
    //     try {
    //         // Remove espaços e substitui vírgula por ponto
    //         const valorLimpo = valor.toString().replace(/\s/g, '').replace(',', '.');
    //         const numero = parseFloat(valorLimpo);
    //         return isNaN(numero) ? 0 : numero;
    //     } catch (erro) {
    //         console.warn('Erro ao converter valor monetário:', valor, erro);
    //         return 0;
    //     }
    // }

    /**
     * Determina o tipo de SPED baseado no conteúdo E nome do arquivo
     * @param {Array} linhas - Linhas do arquivo SPED
     * @param {String} nomeArquivo - Nome do arquivo (opcional)
     * @returns {String} - Tipo do SPED detectado
     */
    function determinarTipoSped(linhas, nomeArquivo = '') {
        if (!Array.isArray(linhas) || linhas.length === 0) {
            return 'fiscal';
        }

        // PRIMEIRO: Tentar determinar pelo nome do arquivo
        if (nomeArquivo && nomeArquivo.trim() !== '') {
            const tipoArquivo = determinarTipoPorNomeArquivo(nomeArquivo);
            if (tipoArquivo !== 'indefinido') {
                console.log(`SPED-PARSER: Tipo detectado pelo nome do arquivo "${nomeArquivo}": ${tipoArquivo}`);
                return tipoArquivo;
            }
        }

        // SEGUNDO: Registros identificadores COMPLETOS por tipo de SPED
        const identificadores = {
            contribuicoes: [
                // Bloco 0
                '0110', '0140',
                // Bloco A  
                'A100', 'A110', 'A111',
                // Bloco C
                'C180', 'C181', 'C185', 'C188',
                // Bloco D
                'D100', 'D101', 'D105', 'D111',
                // Bloco F
                'F100', 'F111', 'F120', 'F129', 'F130', 'F139', 'F150', 'F200', 'F205', 'F210', 'F211',
                // Bloco I
                'I100', 'I199',
                // Bloco M
                'M100', 'M105', 'M110', 'M115', 'M200', 'M205', 'M210', 'M215', 'M220', 'M225', 'M400', 'M410',
                'M500', 'M505', 'M510', 'M515', 'M600', 'M605', 'M610', 'M615', 'M620', 'M625', 'M800', 'M810',
                // Bloco P
                'P100', 'P110', 'P199', 'P200', 'P210',
                // Blocos de totalização
                '1001', '1100', '1200', '1300', '1500'
            ],
            ecf: [
                // Bloco 0
                '0010', '0020',
                // Bloco J
                'J001', 'J050', 'J051', 'J100',
                // Bloco K
                'K001', 'K030', 'K155', 'K156',
                // Bloco L
                'L001', 'L030', 'L100',
                // Bloco M
                'M001', 'M010', 'M300', 'M350',
                // Bloco N
                'N001', 'N500', 'N600', 'N610', 'N620', 'N630', 'N650', 'N660', 'N670',
                // Bloco P
                'P001', 'P030', 'P100', 'P130', 'P150', 'P200', 'P230',
                // Bloco T
                'T001', 'T030', 'T120', 'T150',
                // Bloco U
                'U001', 'U030', 'U100',
                // Registros especiais
                'Y540'
            ],
            ecd: [
                // Bloco 0
                '0007', '0020',
                // Bloco I
                'I001', 'I010', 'I012', 'I015', 'I020', 'I030', 'I050', 'I051', 'I052', 'I053', 
                'I100', 'I150', 'I155', 'I200', 'I250', 'I300', 'I310', 'I350', 'I355',
                // Bloco J
                'J001', 'J005', 'J100', 'J150',
                // Bloco K
                'K001', 'K030', 'K100', 'K155', 'K156', 'K200', 'K220', 'K230', 'K300'
            ],
            fiscal: [
                // Bloco 0
                '0001', '0005', '0150', '0190', '0200',
                // Bloco C
                'C100', 'C170', 'C190', 'C197',
                // Bloco E
                'E110', 'E111', 'E116', 'E200', 'E210', 'E220',
                // Bloco H
                'H010', 'H020',
                // Bloco 9 (controle)
                '9900', '9990', '9999'
            ]
        };

        // Contadores para cada tipo
        const contadores = {
            contribuicoes: 0,
            ecf: 0,
            ecd: 0,
            fiscal: 0
        };

        // Analisar até 100 primeiras linhas para maior precisão
        const limiteLinha = Math.min(100, linhas.length);

        for (let i = 0; i < limiteLinha; i++) {
            const linha = linhas[i];
            if (!linha || linha.trim().length === 0) continue;

            const campos = linha.split('|');
            if (campos.length < 2) continue;

            const registro = campos[1];

            // Contar ocorrências por tipo
            Object.keys(identificadores).forEach(tipo => {
                if (identificadores[tipo].includes(registro)) {
                    contadores[tipo]++;
                }
            });
        }

        // Determinar tipo baseado no maior contador
        let tipoDetectado = 'fiscal'; // padrão
        let maiorContador = contadores.fiscal;

        Object.keys(contadores).forEach(tipo => {
            if (contadores[tipo] > maiorContador) {
                maiorContador = contadores[tipo];
                tipoDetectado = tipo;
            }
        });

        console.log('SPED-PARSER: Detecção por conteúdo:', contadores, '→', tipoDetectado);
        return tipoDetectado;
    }

    /**
     * Determina o tipo de SPED baseado no nome do arquivo
     * @param {String} nomeArquivo - Nome do arquivo
     * @returns {String} - Tipo detectado ou 'indefinido'
     */
    function determinarTipoPorNomeArquivo(nomeArquivo) {
        if (!nomeArquivo || typeof nomeArquivo !== 'string') {
            return 'indefinido';
        }

        // Converter para minúsculas para comparação case-insensitive
        const nome = nomeArquivo.toLowerCase();

        // Padrões para EFD Contribuições (PIS/COFINS)
        const padroesPisConfins = [
            /contribuic(o|ã)es/i,
            /pis[_\-]?cofins/i,
            /efd[_\-]?contribuic/i,
            /efd[_\-]?pis/i,
            /sped[_\-]?contribuic/i,
            /sped[_\-]?pis/i
        ];

        // Padrões para ECF (Escrituração Contábil Fiscal)
        const padroesEcf = [
            /^ecf[_\-]/i,
            /[_\-]ecf[_\-]/i,
            /escriturac(a|ã)o[_\-]?contabil[_\-]?fiscal/i,
            /sped[_\-]?ecf/i,
            /ecd[_\-]?fiscal/i
        ];

        // Padrões para ECD (Escrituração Contábil Digital)
        const padroesEcd = [
            /^ecd[_\-]/i,
            /[_\-]ecd[_\-]/i,
            /escriturac(a|ã)o[_\-]?contabil[_\-]?digital/i,
            /sped[_\-]?ecd/i,
            /contabil[_\-]?digital/i
        ];

        // Padrões para EFD ICMS/IPI (Fiscal)
        const padroesFiscal = [
            /^efd[_\-]/i,
            /fiscal/i,
            /icms[_\-]?ipi/i,
            /sped[_\-]?fiscal/i,
            /efd[_\-]?icms/i,
            /nota[_\-]?fiscal/i
        ];

        // Verificar padrões na ordem de especificidade
        // 1. EFD Contribuições (mais específico)
        for (const padrao of padroesPisConfins) {
            if (padrao.test(nome)) {
                return 'contribuicoes';
            }
        }

        // 2. ECF
        for (const padrao of padroesEcf) {
            if (padrao.test(nome)) {
                return 'ecf';
            }
        }

        // 3. ECD
        for (const padrao of padroesEcd) {
            if (padrao.test(nome)) {
                return 'ecd';
            }
        }

        // 4. EFD ICMS/IPI (Fiscal) - mais genérico
        for (const padrao of padroesFiscal) {
            if (padrao.test(nome)) {
                return 'fiscal';
            }
        }

        // Verificação adicional por extensões específicas com padrões
        const extensao = nome.split('.').pop();

        // Alguns sistemas usam extensões específicas
        if (extensao === 'efd' || extensao === 'sped') {
            // Se contém palavras-chave específicas
            if (nome.includes('pis') || nome.includes('cofins') || nome.includes('contribuic')) {
                return 'contribuicoes';
            } else if (nome.includes('ecf')) {
                return 'ecf';
            } else if (nome.includes('ecd')) {
                return 'ecd';
            } else {
                return 'fiscal'; // padrão para .efd/.sped genéricos
            }
        }

        // Não foi possível determinar pelo nome
        return 'indefinido';
    }
    
    function validarConsistenciaAjustesBc(dadosM210, dadosM215) {
        if (!dadosM210 || !dadosM215 || dadosM215.length === 0) return true;

        // Somar ajustes de acréscimo dos registros M215
        const totalAcrescimo = dadosM215
            .filter(item => item.indAjusteBc === '0')
            .reduce((total, item) => total + item.valorAjusteBc, 0);

        // Somar ajustes de redução dos registros M215
        const totalReducao = dadosM215
            .filter(item => item.indAjusteBc === '1')
            .reduce((total, item) => total + item.valorAjusteBc, 0);

        // Validar consistência
        const consisteAcrescimo = Math.abs(totalAcrescimo - dadosM210.valorAjustesAcrescimoBc) < 0.01;
        const consisteReducao = Math.abs(totalReducao - dadosM210.valorAjustesReducaoBc) < 0.01;

        if (!consisteAcrescimo || !consisteReducao) {
            console.warn('Inconsistência detectada entre M210 e M215:', {
                m210Acrescimo: dadosM210.valorAjustesAcrescimoBc,
                m215Acrescimo: totalAcrescimo,
                m210Reducao: dadosM210.valorAjustesReducaoBc,
                m215Reducao: totalReducao
            });
            return false;
        }

        return true;
    }
    
    /**
     * Valida a consistência entre ajustes BC no M210 e detalhamentos M215
     * @param {Object} dadosM210 - Dados do registro M210
     * @param {Array} dadosM215 - Array de registros M215 relacionados
     * @returns {boolean} - Verdadeiro se consistente
     */
    function validarConsistenciaAjustesBC(dadosM210, dadosM215) {
        if (!dadosM210 || !dadosM215 || dadosM215.length === 0) return true;

        // Somar ajustes de acréscimo dos registros M215
        const totalAcrescimo = dadosM215
            .filter(item => item.indAjusteBc === '0')
            .reduce((total, item) => total + item.valorAjusteBc, 0);

        // Somar ajustes de redução dos registros M215
        const totalReducao = dadosM215
            .filter(item => item.indAjusteBc === '1')
            .reduce((total, item) => total + item.valorAjusteBc, 0);

        // Validar consistência
        const consisteAcrescimo = Math.abs(totalAcrescimo - dadosM210.valorAjustesAcrescimoBc) < 0.01;
        const consisteReducao = Math.abs(totalReducao - dadosM210.valorAjustesReducaoBc) < 0.01;

        if (!consisteAcrescimo || !consisteReducao) {
            console.warn('Inconsistência detectada entre M210 e M215:', {
                m210Acrescimo: dadosM210.valorAjustesAcrescimoBc,
                m215Acrescimo: totalAcrescimo,
                m210Reducao: dadosM210.valorAjustesReducaoBc,
                m215Reducao: totalReducao
            });
            return false;
        }

        return true;
    }

    /**
     * Verifica consistência da base de cálculo ajustada
     * @param {Object} dados - Registro M210 ou M610
     * @returns {boolean} - Verdadeiro se cálculo consistente
     */
    function verificarConsistenciaBaseCalculada(dados) {
        if (!dados) return true;

        // Fórmula: BC Ajustada = BC Original + Acréscimos - Reduções
        const baseCalculada = dados.valorBaseCalculoAntes + dados.valorAjustesAcrescimoBc - dados.valorAjustesReducaoBc;
        const baseInformada = dados.valorBaseCalculoAjustada;

        // Tolerância de 0.01 para diferenças de arredondamento
        const consistente = Math.abs(baseCalculada - baseInformada) < 0.01;

        if (!consistente) {
            console.warn('Inconsistência na base de cálculo ajustada:', {
                baseOriginal: dados.valorBaseCalculoAntes,
                acrescimos: dados.valorAjustesAcrescimoBc,
                reducoes: dados.valorAjustesReducaoBc,
                baseCalculada: baseCalculada,
                baseInformada: baseInformada,
                diferenca: Math.abs(baseCalculada - baseInformada)
            });
            return false;
        }

        return true;
    }

    function calcularBaseCalculoAjustada(baseOriginal, acrescimo, reducao) {
        return baseOriginal + acrescimo - reducao;
    }

    function calcularContribuicaoComAjustes(dados) {
        if (!dados.valorBaseCalculoAjustada || !dados.aliqPis) return 0;

        // Para contribuições por percentual
        if (dados.aliqPis > 0) {
            return dados.valorBaseCalculoAjustada * (dados.aliqPis / 100);
        }

        // Para contribuições por quantidade
        if (dados.quantBcPis > 0 && dados.aliqPisQuant > 0) {
            return dados.quantBcPis * dados.aliqPisQuant;
        }

        return 0;
    }

    /**
     * Integra dados do registro no resultado final
     */
    function integrarDados(resultado, dadosRegistro, registro) {
        if (!dadosRegistro || !dadosRegistro.tipo) return;

        switch (dadosRegistro.tipo) {
            case 'empresa':
                Object.assign(resultado.empresa, dadosRegistro);
                break;

            case 'documento':
                resultado.documentos.push(dadosRegistro);
                break;

            case 'item':
            case 'item_documento':
                resultado.itens.push(dadosRegistro);
                break;

            case 'analitico_icms':
                resultado.itensAnaliticos.push(dadosRegistro);
                break;

            case 'participante':
                resultado.participantes.push(dadosRegistro);
                break;

            case 'credito':
            case 'credito_detalhe':
                if (dadosRegistro.categoria) {
                    if (!resultado.creditos[dadosRegistro.categoria]) {
                        resultado.creditos[dadosRegistro.categoria] = [];
                    }
                    resultado.creditos[dadosRegistro.categoria].push(dadosRegistro);
                }
                break;

            case 'debito':
                if (dadosRegistro.categoria) {
                    if (!resultado.debitos[dadosRegistro.categoria]) {
                        resultado.debitos[dadosRegistro.categoria] = [];
                    }
                    resultado.debitos[dadosRegistro.categoria].push(dadosRegistro);
                }
                break;

            case 'ajuste':
                if (dadosRegistro.categoria) {
                    if (!resultado.ajustes[dadosRegistro.categoria]) {
                        resultado.ajustes[dadosRegistro.categoria] = [];
                    }
                    resultado.ajustes[dadosRegistro.categoria].push(dadosRegistro);
                }
                break;

            case 'regime':
                if (dadosRegistro.categoria) {
                    resultado.regimes[dadosRegistro.categoria] = dadosRegistro;
                }
                break;

            case 'receita_nao_tributada':
                if (dadosRegistro.categoria) {
                    if (!resultado.receitasNaoTributadas[dadosRegistro.categoria]) {
                        resultado.receitasNaoTributadas[dadosRegistro.categoria] = [];
                    }
                    resultado.receitasNaoTributadas[dadosRegistro.categoria].push(dadosRegistro);
                }
                break;

            case 'balanco_patrimonial':
            case 'dados_balancos':
                resultado.balancoPatrimonial.push(dadosRegistro);
                break;

            case 'dre':
            case 'dre_comparativo':
                resultado.demonstracaoResultado.push(dadosRegistro);
                break;

            case 'inventario_abertura':
            case 'inventario_info':
                resultado.inventario.push(dadosRegistro);
                break;

            case 'totalizacao':
                if (dadosRegistro.categoria) {
                    if (!resultado.totalizacao[dadosRegistro.categoria]) {
                        resultado.totalizacao[dadosRegistro.categoria] = [];
                    }
                    resultado.totalizacao[dadosRegistro.categoria].push(dadosRegistro);
                }
                break;

            default:
                // Para outros tipos, armazenar em detalhamento
                if (!resultado.detalhamento[dadosRegistro.tipo]) {
                    resultado.detalhamento[dadosRegistro.tipo] = [];
                }
                resultado.detalhamento[dadosRegistro.tipo].push(dadosRegistro);
                break;
        }
    }
    
    function integrarDadosContribuicoes(resultado, dadosRegistro, registro) {
        if (!dadosRegistro || !dadosRegistro.tipo) return;

        switch (dadosRegistro.tipo) {
            case 'detalhamento_contribuicao':
                if (!resultado.detalhamentoContribuicoes) {
                    resultado.detalhamentoContribuicoes = {};
                }
                if (!resultado.detalhamentoContribuicoes[dadosRegistro.categoria]) {
                    resultado.detalhamentoContribuicoes[dadosRegistro.categoria] = [];
                }
                resultado.detalhamentoContribuicoes[dadosRegistro.categoria].push(dadosRegistro);
                break;

            case 'ajuste_base_calculo':
                if (!resultado.ajustesBaseCalculo) {
                    resultado.ajustesBaseCalculo = {};
                }
                if (!resultado.ajustesBaseCalculo[dadosRegistro.categoria]) {
                    resultado.ajustesBaseCalculo[dadosRegistro.categoria] = [];
                }
                resultado.ajustesBaseCalculo[dadosRegistro.categoria].push(dadosRegistro);
                break;

            default:
                // Manter integração existente para outros tipos
                integrarDados(resultado, dadosRegistro, registro);
                break;
        }
    }

    /**
     * Processa relações entre dados após a extração
     */
    function processarRelacoesEntreDados(resultado, tipoSped) {
        // Relacionar participantes com documentos
        if (resultado.participantes.length > 0 && resultado.documentos.length > 0) {
            const participantesPorCodigo = {};
            resultado.participantes.forEach(participante => {
                if (participante.codigo) {
                    participantesPorCodigo[participante.codigo] = participante;
                }
            });

            resultado.documentos.forEach(doc => {
                if (doc.codPart && participantesPorCodigo[doc.codPart]) {
                    doc.participante = participantesPorCodigo[doc.codPart];
                }
            });
        }

        // Relacionar itens com documentos
        if (resultado.itens.length > 0 && resultado.documentos.length > 0) {
            const itensPorCodigo = {};
            resultado.itens.forEach(item => {
                if (item.codItem || item.codigo) {
                    itensPorCodigo[item.codItem || item.codigo] = item;
                }
            });

            resultado.itens.forEach(item => {
                if (item.codItem && itensPorCodigo[item.codItem]) {
                    item.detalhesItem = itensPorCodigo[item.codItem];
                }
            });
        }

        // Calcular totais por categoria
        calcularTotaisPorCategoria(resultado);
    }
    
    // Adicionar após a função processarRelacoesEntreDados(resultado, tipoSped)
    // ...

    function normalizarPropriedadesEmpresa(resultado) {
        if (resultado.empresa) {
            // Garantir que o nome da empresa esteja sempre no campo 'nome'
            if (!resultado.empresa.nome && resultado.empresa.nomeEmpresarial) {
                resultado.empresa.nome = resultado.empresa.nomeEmpresarial;
            }

            // Log para diagnóstico
            console.log('SPED-PARSER: Propriedades normalizadas da empresa:', {
                nome: resultado.empresa.nome,
                nomeEmpresarial: resultado.empresa.nomeEmpresarial,
                cnpj: resultado.empresa.cnpj
            });
        }
    }
   
    /**
     * Calcula totais por categoria de impostos com maior precisão
     */
    function calcularTotaisPorCategoria(resultado) {
        console.log('SPED-PARSER: Calculando totais por categoria de impostos');
        // Inicializar objetos para acumular valores
        const totaisPorImposto = {
            pis: { 
                creditos: 0, 
                debitos: 0, 
                ajustesCredito: 0, 
                ajustesDebito: 0, 
                ajustesAcrescimoBc: 0, // Novo campo para ajustes de acréscimo na BC
                ajustesReducaoBc: 0,   // Novo campo para ajustes de redução na BC
                baseCalculoOriginal: 0, // Base de cálculo antes dos ajustes
                baseCalculoAjustada: 0, // Base de cálculo após ajustes
                saldoAnterior: 0, 
                total: 0 
            },
            cofins: { 
                creditos: 0, 
                debitos: 0, 
                ajustesCredito: 0, 
                ajustesDebito: 0, 
                ajustesAcrescimoBc: 0, // Novo campo para ajustes de acréscimo na BC
                ajustesReducaoBc: 0,   // Novo campo para ajustes de redução na BC
                baseCalculoOriginal: 0, // Base de cálculo antes dos ajustes
                baseCalculoAjustada: 0, // Base de cálculo após ajustes
                saldoAnterior: 0, 
                total: 0 
            },
            icms: { creditos: 0, debitos: 0, ajustesCredito: 0, ajustesDebito: 0, saldoAnterior: 0, total: 0 },
            ipi: { creditos: 0, debitos: 0, ajustesCredito: 0, ajustesDebito: 0, saldoAnterior: 0, total: 0 }
        };

        // Processar créditos
        Object.keys(resultado.creditos).forEach(categoria => {
            // Código existente para processar créditos...
            const creditos = resultado.creditos[categoria];
            let totalCreditos = 0;
            creditos.forEach(credito => {
                const valorCredito = credito.valorCredito ||
                    credito.valorCreditoDisp ||
                    credito.valorTotalCreditos || 0;
                if (valorCredito > 0) {
                    totalCreditos += valorCredito;
                    console.log(`SPED-PARSER: Crédito ${categoria} encontrado: ${valorCredito.toFixed(2)}`);
                }
            });
            // Resto do código para totalização de créditos...
        });

        // Processar débitos e ajustes de base de cálculo
        Object.keys(resultado.debitos).forEach(categoria => {
            const debitos = resultado.debitos[categoria];
            let totalDebitos = 0;
            let saldoAnterior = 0;
            let baseCalculoOriginal = 0;
            let ajustesAcrescimoBc = 0;
            let ajustesReducaoBc = 0;
            let baseCalculoAjustada = 0;

            debitos.forEach(debito => {
                // Verificar todos os possíveis campos que contêm valor de débito
                const valorDebito = debito.valorTotalDebitos ||
                    debito.valorTotalContribuicao ||
                    debito.valorContribuicaoAPagar || 0;

                // Capturar saldo anterior
                if (debito.valorSaldoCredorAnterior > 0) {
                    saldoAnterior = debito.valorSaldoCredorAnterior;
                }

                // Capturar base de cálculo e ajustes (novos campos)
                if (debito.valorBaseCalculo > 0 || debito.valorBaseCalculoAntes > 0) {
                    baseCalculoOriginal += debito.valorBaseCalculo || debito.valorBaseCalculoAntes || 0;
                }

                // Novos campos de ajuste da base de cálculo
                if (debito.valorAjustesAcrescimoBc > 0) {
                    ajustesAcrescimoBc += debito.valorAjustesAcrescimoBc;
                }

                if (debito.valorAjustesReducaoBc > 0) {
                    ajustesReducaoBc += debito.valorAjustesReducaoBc;
                }

                // Base de cálculo ajustada
                if (debito.valorBaseCalculoAjustada > 0) {
                    baseCalculoAjustada += debito.valorBaseCalculoAjustada;
                } else if (baseCalculoOriginal > 0) {
                    // Calcular a base ajustada se não estiver explicitamente disponível
                    baseCalculoAjustada = baseCalculoOriginal + ajustesAcrescimoBc - ajustesReducaoBc;
                }

                if (valorDebito > 0) {
                    totalDebitos += valorDebito;
                    console.log(`SPED-PARSER: Débito ${categoria} encontrado: ${valorDebito.toFixed(2)}`);
                }
            });

            // Atualizar totais e armazenar no resultado
            if (totaisPorImposto[categoria]) {
                totaisPorImposto[categoria].debitos = totalDebitos;
                totaisPorImposto[categoria].saldoAnterior = saldoAnterior;
                totaisPorImposto[categoria].baseCalculoOriginal = baseCalculoOriginal;
                totaisPorImposto[categoria].ajustesAcrescimoBc = ajustesAcrescimoBc;
                totaisPorImposto[categoria].ajustesReducaoBc = ajustesReducaoBc;
                totaisPorImposto[categoria].baseCalculoAjustada = baseCalculoAjustada;

                // Logs detalhados...
            }

            // Armazenar no resultado.calculoImposto
            if (!resultado.calculoImposto[categoria]) {
                resultado.calculoImposto[categoria] = {};
            }

            resultado.calculoImposto[categoria].totalDebitos = totalDebitos;
            resultado.calculoImposto[categoria].baseCalculoOriginal = baseCalculoOriginal;
            resultado.calculoImposto[categoria].ajustesAcrescimoBc = ajustesAcrescimoBc;
            resultado.calculoImposto[categoria].ajustesReducaoBc = ajustesReducaoBc;
            resultado.calculoImposto[categoria].baseCalculoAjustada = baseCalculoAjustada;
        });

        // Processar ajustes de contribuição (M220/M620)
        // Código existente para processar ajustes...

        // Processar ajustes de base de cálculo (M215/M615) - NOVO
        if (resultado.ajustesBaseCalculo) {
            Object.keys(resultado.ajustesBaseCalculo).forEach(categoria => {
                const ajustesBC = resultado.ajustesBaseCalculo[categoria];

                // Inicializar contadores se não existirem
                if (!resultado.calculoImposto[categoria]) {
                    resultado.calculoImposto[categoria] = {};
                }

                if (!resultado.calculoImposto[categoria].detalhamentoAjustesBC) {
                    resultado.calculoImposto[categoria].detalhamentoAjustesBC = [];
                }

                let totalAcrescimos = 0;
                let totalReducoes = 0;

                ajustesBC.forEach(ajuste => {
                    // Verificar tipo de ajuste (acréscimo ou redução)
                    if (ajuste.indAjusteBc === '0' || ajuste.tipoAjuste === 'acrescimo') {
                        totalAcrescimos += ajuste.valorAjusteBc || 0;
                        console.log(`SPED-PARSER: Ajuste acréscimo BC ${categoria}: ${ajuste.valorAjusteBc?.toFixed(2) || 0}`);
                    } else if (ajuste.indAjusteBc === '1' || ajuste.tipoAjuste === 'reducao') {
                        totalReducoes += ajuste.valorAjusteBc || 0;
                        console.log(`SPED-PARSER: Ajuste redução BC ${categoria}: ${ajuste.valorAjusteBc?.toFixed(2) || 0}`);
                    }

                    // Armazenar detalhamento do ajuste
                    resultado.calculoImposto[categoria].detalhamentoAjustesBC.push({
                        tipo: ajuste.tipoAjuste || (ajuste.indAjusteBc === '0' ? 'acrescimo' : 'reducao'),
                        codigo: ajuste.codAjusteBc,
                        descricao: ajuste.descrAjusteBc,
                        valor: ajuste.valorAjusteBc || 0,
                        dataRef: ajuste.dataRef,
                        documento: ajuste.numDoc,
                        cnpj: ajuste.cnpj,
                        infoCompl: ajuste.infoCompl
                    });
                });

                // Atualizar totais dos ajustes
                totaisPorImposto[categoria].ajustesAcrescimoBc += totalAcrescimos;
                totaisPorImposto[categoria].ajustesReducaoBc += totalReducoes;

                // Atualizar valores no resultado
                resultado.calculoImposto[categoria].totalAjustesAcrescimoBC = totalAcrescimos;
                resultado.calculoImposto[categoria].totalAjustesReducaoBC = totalReducoes;
            });
        }

        // Calcular valores líquidos finais e atualizar o resultado
        Object.keys(totaisPorImposto).forEach(imposto => {
            const valores = totaisPorImposto[imposto];

            // Atualizar base de cálculo ajustada se necessário
            if (valores.baseCalculoOriginal > 0 && valores.baseCalculoAjustada === 0) {
                valores.baseCalculoAjustada = valores.baseCalculoOriginal + valores.ajustesAcrescimoBc - valores.ajustesReducaoBc;
            }

            // Cálculo com ajustes
            const creditosComAjustes = valores.creditos + valores.ajustesCredito;
            const debitosComAjustes = valores.debitos + valores.ajustesDebito;

            // Valor total considerando saldo anterior
            valores.total = Math.max(0, debitosComAjustes - creditosComAjustes - valores.saldoAnterior);

            // Atualizar calculoImposto com valores finais
            if (!resultado.calculoImposto[imposto]) {
                resultado.calculoImposto[imposto] = {};
            }

            resultado.calculoImposto[imposto].valorTotal = valores.total;
            resultado.calculoImposto[imposto].creditosComAjustes = creditosComAjustes;
            resultado.calculoImposto[imposto].debitosComAjustes = debitosComAjustes;

            if (valores.baseCalculoAjustada > 0) {
                resultado.calculoImposto[imposto].baseCalculoAjustada = valores.baseCalculoAjustada;
            }

            // Logs finais
            console.log(`SPED-PARSER: Valor líquido ${imposto}: ${valores.total.toFixed(2)}`);
        });

        console.log('SPED-PARSER: Cálculo de totais concluído');
        return resultado.calculoImposto;
    }


    // =============================
    // FUNÇÕES DE PARSING ESPECÍFICAS - SPED FISCAL
    // =============================

    // Registro 0000 - Abertura do arquivo e identificação da entidade
    // Registro 0000 - Abertura do arquivo e identificação da entidade
    function parseRegistro0000(campos) {
        if (!validarEstruturaRegistro(campos, 15)) {
            console.warn('Registro 0000 com estrutura insuficiente:', campos.length, 'campos encontrados');
            return null;
        }

        try {
            // CORREÇÃO: Campos corretos conforme layout SPED
            const nome = validarCampo(campos, 6); // Nome empresarial está no campo 6
            const cnpj = validarCampo(campos, 7); // CNPJ está no campo 7

            if (!nome || nome.trim() === '') {
                console.warn('Nome da empresa não encontrado no registro 0000 (campo 6)');
            }

            if (!cnpj || cnpj.trim() === '') {
                console.warn('CNPJ da empresa não encontrado no registro 0000 (campo 7)');
            }

            return {
                tipo: 'empresa',
                categoria: 'identificacao',
                versaoLeiaute: validarCampo(campos, 3),
                finalidade: validarCampo(campos, 4),
                dataInicial: validarCampo(campos, 5),
                dataFinal: validarCampo(campos, 6),
                nomeEmpresarial: nome,
                cnpj: cnpj,
                nome: nome, // Nome correto
                uf: validarCampo(campos, 8), // UF está no campo 8
                ie: validarCampo(campos, 9), // IE está no campo 9
                codMunicipio: validarCampo(campos, 10), // Código do município está no campo 10
                im: validarCampo(campos, 11),
                suframa: validarCampo(campos, 12),
                perfil: validarCampo(campos, 13),
                atividade: validarCampo(campos, 14)
            };
        } catch (erro) {
            console.warn('Erro ao processar registro 0000:', erro.message, 'Conteúdo do campo:', JSON.stringify(campos));
            return null;
        }
    }

    function parseRegistro0001(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            bloco: '0',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistro0005(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'empresa',
            fantasia: validarCampo(campos, 2),
            cep: validarCampo(campos, 3),
            endereco: validarCampo(campos, 4),
            numero: validarCampo(campos, 5),
            complemento: validarCampo(campos, 6),
            bairro: validarCampo(campos, 7)
        };
    }

    function parseRegistro0150(campos) {
        if (!validarEstruturaRegistro(campos, 11)) return null;
        return {
            tipo: 'participante',
            codigo: validarCampo(campos, 2),
            nome: validarCampo(campos, 3),
            codigoPais: validarCampo(campos, 4),
            cnpjCpf: validarCampo(campos, 5),
            ie: validarCampo(campos, 6),
            codigoMunicipio: validarCampo(campos, 7),
            suframa: validarCampo(campos, 8),
            endereco: validarCampo(campos, 9),
            numero: validarCampo(campos, 10)
        };
    }

    function parseRegistro0190(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'unidade_medida',
            codigo: validarCampo(campos, 2),
            descricao: validarCampo(campos, 3)
        };
    }

    function parseRegistro0200(campos) {
        if (!validarEstruturaRegistro(campos, 9)) return null;
        return {
            tipo: 'item',
            codigo: validarCampo(campos, 2),
            descricao: validarCampo(campos, 3),
            codigoBarras: validarCampo(campos, 4),
            codigoAntItem: validarCampo(campos, 5),
            unidadeInvent: validarCampo(campos, 6),
            tipoItem: validarCampo(campos, 7),
            ncm: validarCampo(campos, 8),
            exTipi: validarCampo(campos, 9)
        };
    }

    // Registro C100 - Documento Fiscal
    function parseRegistroC100(campos) {
        // Log para debug
        if (campos.length > 12 && campos[12]) {
            console.log('Registro C100 - Valor do campo 12:', campos[12]);
        }

        const documento = {
            tipo: 'documento',
            indOper: campos[2], // 0=Entrada, 1=Saída
            indEmit: campos[3],
            codPart: campos[4],
            modelo: campos[5],
            serie: campos[7],
            numero: campos[8],
            chaveNFe: campos[9],
            dataEmissao: campos[10],
            dataSaidaEntrada: campos[11],
            valorTotal: parseValorMonetario(campos[12]), // Valor do documento
            valorProdutos: parseValorMonetario(campos[16]) // Valor dos produtos
        };

        // Log do documento parseado
        if (documento.valorTotal > 0) {
            console.log('Documento C100 parseado:', documento);
        }

        return documento;
    }

    // Registro C170 - Item do Documento
    function parseRegistroC170(campos) {
        if (!validarEstruturaRegistro(campos, 17)) {
            console.warn('Registro C170 com estrutura insuficiente:', campos.length);
            return null;
        }

        try {
            return {
                tipo: 'item_documento',
                categoria: 'item',
                numItem: validarCampo(campos, 2),
                codItem: validarCampo(campos, 3),
                descrItem: validarCampo(campos, 4),
                qtd: parseFloat(validarCampo(campos, 5, '0').replace(',', '.')) || 0,
                unid: validarCampo(campos, 6),
                valorItem: parseValorMonetario(validarCampo(campos, 7, '0')), // ✅ Correto
                valorTotalItem: parseValorMonetario(validarCampo(campos, 7, '0')), // ✅ Corrigido: usar VL_ITEM
                valorDesc: parseValorMonetario(validarCampo(campos, 8, '0')), // ✅ Correto: campo 8 é desconto
                indMov: validarCampo(campos, 9),
                cstIcms: validarCampo(campos, 10),
                cfop: validarCampo(campos, 11),
                codNat: validarCampo(campos, 12),
                valorBcIcms: parseValorMonetario(validarCampo(campos, 13, '0')), // ✅ Corrigido: índice 13
                aliqIcms: parseFloat(validarCampo(campos, 14, '0').replace(',', '.')) || 0, // ✅ Corrigido: índice 14
                valorIcms: parseValorMonetario(validarCampo(campos, 15, '0')), // ✅ Corrigido: índice 15
                valorBcIcmsSt: parseValorMonetario(validarCampo(campos, 16, '0')),
                aliqIcmsSt: parseFloat(validarCampo(campos, 17, '0').replace(',', '.')) || 0,
                valorIcmsSt: parseValorMonetario(validarCampo(campos, 18, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro C170:', erro.message);
            return null;
        }
    }

    function parseRegistroC197(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'outras_obrigacoes',
            categoria: 'icms',
            codigoAjOuInf: validarCampo(campos, 2),
            descrCompl: validarCampo(campos, 3),
            valorAjuste: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }
    
    function parseRegistroC190(campos) {
        if (!validarEstruturaRegistro(campos, 9)) {
            console.warn('Registro C190 com estrutura insuficiente:', campos.length);
            return null;
        }

        try {
            return {
                tipo: 'analitico_icms',
                categoria: 'icms',
                cstIcms: validarCampo(campos, 2),
                cfop: validarCampo(campos, 3),
                aliqIcms: parseFloat(validarCampo(campos, 4, '0').replace(',', '.')) || 0,
                valorOpr: parseValorMonetario(validarCampo(campos, 5, '0')),
                valorBcIcms: parseValorMonetario(validarCampo(campos, 6, '0')),
                valorIcms: parseValorMonetario(validarCampo(campos, 7, '0')),
                valorBcIcmsSt: parseValorMonetario(validarCampo(campos, 8, '0')),
                valorIcmsSt: parseValorMonetario(validarCampo(campos, 9, '0')),
                valorRedBc: parseValorMonetario(validarCampo(campos, 10, '0')),
                valorIpi: parseValorMonetario(validarCampo(campos, 11, '0')),
                codObs: validarCampo(campos, 12)
            };
        } catch (erro) {
            console.warn('Erro ao processar registro C190:', erro.message);
            return null;
        }
    }

   function parseRegistroE110(campos) {
        if (!validarEstruturaRegistro(campos, 15)) {
            console.warn('Registro E110 com estrutura insuficiente:', campos.length, 'campos encontrados (esperado 15+)');
            return null;
        }

        try {
            return {
                tipo: 'debito',
                categoria: 'icms',
                valorTotalDebitos: parseValorMonetario(validarCampo(campos, 2, '0')),      // Campo 02: VL_TOT_DEBITOS
                valorAjustesDebitos: parseValorMonetario(validarCampo(campos, 3, '0')),    // Campo 03: VL_AJ_DEBITOS
                valorTotalAjDebitos: parseValorMonetario(validarCampo(campos, 4, '0')),    // Campo 04: VL_TOT_AJ_DEBITOS
                valorEstornosCredito: parseValorMonetario(validarCampo(campos, 5, '0')),   // Campo 05: VL_ESTORNOS_CRED
                valorTotalCreditos: parseValorMonetario(validarCampo(campos, 6, '0')),     // Campo 06: VL_TOT_CREDITOS
                valorAjustesCreditos: parseValorMonetario(validarCampo(campos, 7, '0')),   // Campo 07: VL_AJ_CREDITOS
                valorTotalAjCreditos: parseValorMonetario(validarCampo(campos, 8, '0')),   // Campo 08: VL_TOT_AJ_CREDITOS
                valorEstornosDebito: parseValorMonetario(validarCampo(campos, 9, '0')),    // Campo 09: VL_ESTORNOS_DEB
                valorSaldoCredorAnterior: parseValorMonetario(validarCampo(campos, 10, '0')), // Campo 10: VL_SLD_CREDOR_ANT
                valorSaldoApurado: parseValorMonetario(validarCampo(campos, 11, '0')),     // Campo 11: VL_SLD_APURADO
                valorTotalDeducoes: parseValorMonetario(validarCampo(campos, 12, '0')),    // Campo 12: VL_TOT_DED
                valorIcmsRecolher: parseValorMonetario(validarCampo(campos, 13, '0')),     // Campo 13: VL_ICMS_RECOLHER
                valorSaldoCredorTransportar: parseValorMonetario(validarCampo(campos, 14, '0')), // Campo 14: VL_SLD_CREDOR_TRANSPORTAR
                valorDebitosEspeciais: parseValorMonetario(validarCampo(campos, 15, '0')), // Campo 15: DEB_ESP
                registro: 'E110'
            };
        } catch (erro) {
            console.warn('Erro ao processar registro E110:', erro.message);
            return null;
        }
    }

    function parseRegistroE111(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'ajuste',
            categoria: 'icms',
            codAjApur: validarCampo(campos, 2),
            descrCompl: validarCampo(campos, 3),
            valorAjuste: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroE116(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'obrigacao',
            categoria: 'icms',
            codOr: validarCampo(campos, 2),
            valorOr: parseValorMonetario(validarCampo(campos, 3, '0')),
            dataVcto: validarCampo(campos, 4),
            codRec: validarCampo(campos, 5)
        };
    }

    function parseRegistroE200(campos) {
        if (!validarEstruturaRegistro(campos, 15)) {
            console.warn('Registro E200 com estrutura insuficiente:', campos.length, 'campos encontrados (esperado 15+)');
            return null;
        }

        try {
            return {
                tipo: 'debito',
                categoria: 'ipi',
                codigoApuracao: validarCampo(campos, 1, ''),                         // Identificador da apuração
                periodoApuracao: validarCampo(campos, 2, ''),                        // Período de apuração
                valorTotalDebitos: parseValorMonetario(validarCampo(campos, 3, '0')),  // Campo 02: VL_TOT_DEBITOS
                valorTotalCreditos: parseValorMonetario(validarCampo(campos, 4, '0')),  // Campo 03: VL_TOT_CREDITOS
                valorSaldoApurado: parseValorMonetario(validarCampo(campos, 5, '0')),   // Campo 04: VL_SLD_APURADO
                valorSaldoAnterior: parseValorMonetario(validarCampo(campos, 6, '0')),  // Campo 05: VL_SLD_CREDOR_ANT
                valorDeducoes: parseValorMonetario(validarCampo(campos, 7, '0')),       // Campo 06: VL_TOT_DED
                valorIpiRecolher: parseValorMonetario(validarCampo(campos, 8, '0')),    // Campo 07: VL_IPI_RECOLHER
                valorSaldoCredorTransportar: parseValorMonetario(validarCampo(campos, 9, '0')), // Campo 08: VL_SLD_CREDOR_TRANSPORTAR
                valorDebitosEspeciais: parseValorMonetario(validarCampo(campos, 10, '0')), // Campo 09: DEB_ESP_ST
                registro: 'E200'
            };
        } catch (erro) {
            console.warn('Erro ao processar registro E200:', erro.message);
            return null;
        }
    }

    function parseRegistroE210(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'ajuste',
            categoria: 'ipi',
            indAj: validarCampo(campos, 2),
            valorAj: parseValorMonetario(validarCampo(campos, 3, '0')),
            codAj: validarCampo(campos, 4)
        };
    }

    function parseRegistroE220(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'informacao_adicional',
            categoria: 'ipi',
            codInfAd: validarCampo(campos, 2),
            txtCompl: validarCampo(campos, 3),
            qtdRef: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroH010(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'inventario_abertura',
            codItem: validarCampo(campos, 2),
            unid: validarCampo(campos, 3),
            qtd: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorUnit: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorItem: parseValorMonetario(validarCampo(campos, 6, '0'))
        };
    }

    function parseRegistroH020(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'inventario_info',
            codItem: validarCampo(campos, 2),
            unid: validarCampo(campos, 3),
            qtd: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorUnit: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorItem: parseValorMonetario(validarCampo(campos, 6, '0'))
        };
    }

    // =============================
    // FUNÇÕES DE PARSING - SPED CONTRIBUIÇÕES
    // =============================

    function parseRegistro0000Contribuicoes(campos) {
        if (!validarEstruturaRegistro(campos, 15)) {
            console.warn('Registro 0000 Contribuições com estrutura insuficiente:', campos.length);
            return null;
        }

        try {
            // Validar campos críticos com mensagens detalhadas
            const cnpj = validarCampo(campos, 8);
            const nome = validarCampo(campos, 9);

            if (!nome || nome.trim() === '') {
                console.warn('Nome da empresa não encontrado no registro 0000 Contribuições (campo 9)');
            }

            return {
                tipo: 'empresa',
                cnpj: cnpj,
                nome: nome,
                ie: validarCampo(campos, 11),
                municipio: validarCampo(campos, 13),  
                uf: validarCampo(campos, 14),
                dataInicial: validarCampo(campos, 5),
                dataFinal: validarCampo(campos, 6),
                versaoLeiaute: validarCampo(campos, 3)
            };
        } catch (erro) {
            console.warn('Erro ao processar registro 0000 Contribuições:', erro.message);
            return null;
        }
    }

    function parseRegistro0001Contribuicoes(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            bloco: '0',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistro0110(campos) {
        if (!validarEstruturaRegistro(campos, 4)) {
            console.warn('Registro 0110 com estrutura insuficiente:', campos.length);
            return null;
        }

        try {
            const codigoIncidencia = validarCampo(campos, 2);

            // Validar código de incidência
            const regimesValidos = ['1', '2', '3'];
            if (!regimesValidos.includes(codigoIncidencia)) {
                console.warn('Código de incidência inválido no registro 0110:', codigoIncidencia);
            }

            return {
                tipo: 'regime',
                categoria: 'pis_cofins',
                codigoIncidencia: codigoIncidencia,
                descricaoRegime: obterDescricaoRegime(codigoIncidencia),
                codigoIncidenciaAnterior: validarCampo(campos, 3),
                indAproCred: validarCampo(campos, 4),
                codTipoContrib: validarCampo(campos, 5),
                indRegCum: validarCampo(campos, 6)
            };
        } catch (erro) {
            console.warn('Erro ao processar registro 0110:', erro.message);
            return null;
        }
    }

    // Função auxiliar para descrição do regime
    function obterDescricaoRegime(codigo) {
        const regimes = {
            '1': 'Apuração com base nos registros de consolidação das operações (Registro C180)',
            '2': 'Apuração com base no registro individualizado de NF (Registro C100)',
            '3': 'Apuração com base nos registros de consolidação das operações (Registro C180) e Registro individualizado de NF (Registro C100)'
        };
        return regimes[codigo] || 'Regime não identificado';
    }

    function parseRegistro0140(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'tabela_cadastro',
            codEst: validarCampo(campos, 2),
            nome: validarCampo(campos, 3),
            codClasse: validarCampo(campos, 4),
            codGru: validarCampo(campos, 5)
        };
    }

    function parseRegistro0150Contribuicoes(campos) {
        if (!validarEstruturaRegistro(campos, 11)) return null;
        return {
            tipo: 'participante',
            codigo: validarCampo(campos, 2),
            nome: validarCampo(campos, 3),
            codigoPais: validarCampo(campos, 4),
            cnpjCpf: validarCampo(campos, 5),
            ie: validarCampo(campos, 6),
            codigoMunicipio: validarCampo(campos, 7)
        };
    }

    function parseRegistroA100(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'receita',
            categoria: 'operacao',
            indOper: validarCampo(campos, 2),
            indEmit: validarCampo(campos, 3),
            codPart: validarCampo(campos, 4),
            codSit: validarCampo(campos, 5),
            valorOperacao: parseValorMonetario(validarCampo(campos, 6, '0'))
        };
    }

    function parseRegistroA110(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'receita_complemento',
            categoria: 'operacao',
            codInf: validarCampo(campos, 2),
            txtCompl: validarCampo(campos, 3),
            valorItem: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroA111(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'processo_referenciado',
            categoria: 'receita',
            numProc: validarCampo(campos, 2),
            indProc: validarCampo(campos, 3)
        };
    }

    function parseRegistroC100Contribuicoes(campos) {
        if (!validarEstruturaRegistro(campos, 18)) return null;
        return {
            tipo: 'documento',
            indOper: validarCampo(campos, 2),
            indEmit: validarCampo(campos, 3),
            codPart: validarCampo(campos, 4),
            codMod: validarCampo(campos, 5),
            codSit: validarCampo(campos, 6),
            numDoc: validarCampo(campos, 7),
            dataDoc: validarCampo(campos, 8),
            valorDoc: parseValorMonetario(validarCampo(campos, 9, '0')),
            valorPis: parseValorMonetario(validarCampo(campos, 10, '0')),
            valorCofins: parseValorMonetario(validarCampo(campos, 11, '0')),
            natBcCred: validarCampo(campos, 12),
            valorTotal: parseValorMonetario(validarCampo(campos, 9, '0')),
            dataEmissao: validarCampo(campos, 8),
            modelo: validarCampo(campos, 5),
            situacao: validarCampo(campos, 6)
        };
    }

    function parseRegistroC180(campos) {
        if (!validarEstruturaRegistro(campos, 12)) return null;
        return {
            tipo: 'consolidacao_operacoes',
            categoria: 'pis_cofins',
            codMod: validarCampo(campos, 2),
            dataIniOper: validarCampo(campos, 3),
            dataFinOper: validarCampo(campos, 4),
            valorTotRec: parseValorMonetario(validarCampo(campos, 5, '0')),
            codCta: validarCampo(campos, 6),
            descrCompl: validarCampo(campos, 7)
        };
    }

    function parseRegistroC181(campos) {
        if (!validarEstruturaRegistro(campos, 17)) return null;
        return {
            tipo: 'detalhamento_consolidacao',
            categoria: 'pis_cofins',
            cstPis: validarCampo(campos, 2),
            codCred: validarCampo(campos, 3),
            valorBc: parseValorMonetario(validarCampo(campos, 4, '0')),
            aliqPis: parseValorMonetario(validarCampo(campos, 5, '0')),
            quantBcPis: parseValorMonetario(validarCampo(campos, 6, '0')),
            aliqPisQuant: parseValorMonetario(validarCampo(campos, 7, '0')),
            valorPis: parseValorMonetario(validarCampo(campos, 8, '0')),
            cstCofins: validarCampo(campos, 9),
            valorBcCofins: parseValorMonetario(validarCampo(campos, 10, '0')),
            aliqCofins: parseValorMonetario(validarCampo(campos, 11, '0')),
            quantBcCofins: parseValorMonetario(validarCampo(campos, 12, '0')),
            aliqCofinsQuant: parseValorMonetario(validarCampo(campos, 13, '0')),
            valorCofins: parseValorMonetario(validarCampo(campos, 14, '0')),
            codCta: validarCampo(campos, 15),
            descrCompl: validarCampo(campos, 16)
        };
    }

    function parseRegistroC185(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'detalhamento_consolidacao_pis',
            categoria: 'pis',
            cstPis: validarCampo(campos, 2),
            codCred: validarCampo(campos, 3),
            valorBc: parseValorMonetario(validarCampo(campos, 4, '0')),
            aliqPis: parseValorMonetario(validarCampo(campos, 5, '0')),
            quantBcPis: parseValorMonetario(validarCampo(campos, 6, '0')),
            aliqPisQuant: parseValorMonetario(validarCampo(campos, 7, '0')),
            valorPis: parseValorMonetario(validarCampo(campos, 8, '0')),
            codCta: validarCampo(campos, 9),
            descrCompl: validarCampo(campos, 10)
        };
    }

    function parseRegistroC188(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'processo_referenciado',
            categoria: 'consolidacao',
            numProc: validarCampo(campos, 2),
            indProc: validarCampo(campos, 3)
        };
    }

    function parseRegistroD100(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'aquisicao_servicos',
            categoria: 'credito',
            indOper: validarCampo(campos, 2),
            indEmit: validarCampo(campos, 3),
            codPart: validarCampo(campos, 4),
            codMod: validarCampo(campos, 5),
            codSit: validarCampo(campos, 6),
            numDoc: validarCampo(campos, 7),
            dataDoc: validarCampo(campos, 8),
            valorDoc: parseValorMonetario(validarCampo(campos, 9, '0')),
            indPgto: validarCampo(campos, 10),
            valorDesc: parseValorMonetario(validarCampo(campos, 11, '0')),
            valorServ: parseValorMonetario(validarCampo(campos, 12, '0'))
        };
    }

    function parseRegistroD101(campos) {
        if (!validarEstruturaRegistro(campos, 13)) return null;
        return {
            tipo: 'credito_detalhe',
            categoria: 'pis',
            indNatPJ: validarCampo(campos, 2),
            valorBcPis: parseValorMonetario(validarCampo(campos, 3, '0')),
            aliqPis: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorPis: parseValorMonetario(validarCampo(campos, 5, '0')),
            codCred: validarCampo(campos, 6)
        };
    }

    function parseRegistroD105(campos) {
        if (!validarEstruturaRegistro(campos, 13)) return null;
        return {
            tipo: 'credito_detalhe',
            categoria: 'cofins',
            indNatPJ: validarCampo(campos, 2),
            valorBcCofins: parseValorMonetario(validarCampo(campos, 3, '0')),
            aliqCofins: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorCofins: parseValorMonetario(validarCampo(campos, 5, '0')),
            codCred: validarCampo(campos, 6)
        };
    }

    function parseRegistroD111(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'processo_referenciado',
            categoria: 'aquisicao',
            numProc: validarCampo(campos, 2),
            indProc: validarCampo(campos, 3)
        };
    }

    function parseRegistroF100(campos) {
        if (!validarEstruturaRegistro(campos, 18)) return null;
        return {
            tipo: 'demais_documentos',
            categoria: 'operacao',
            indOper: validarCampo(campos, 2),
            codPart: validarCampo(campos, 3),
            codItem: validarCampo(campos, 4),
            dataOper: validarCampo(campos, 5),
            valorOper: parseValorMonetario(validarCampo(campos, 6, '0')),
            cstPis: validarCampo(campos, 7),
            valorBcPis: parseValorMonetario(validarCampo(campos, 8, '0')),
            aliqPisPerc: parseValorMonetario(validarCampo(campos, 9, '0')),
            valorPis: parseValorMonetario(validarCampo(campos, 10, '0')),
            cstCofins: validarCampo(campos, 11),
            valorBcCofins: parseValorMonetario(validarCampo(campos, 12, '0')),
            aliqCofinsPerc: parseValorMonetario(validarCampo(campos, 13, '0')),
            valorCofins: parseValorMonetario(validarCampo(campos, 14, '0')),
            natBcCred: validarCampo(campos, 15),
            indOrigCred: validarCampo(campos, 16),
            codCred: validarCampo(campos, 17),
            valorCredDisp: parseValorMonetario(validarCampo(campos, 18, '0'))
        };
    }

    function parseRegistroF111(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'processo_referenciado',
            categoria: 'demais_documentos',
            numProc: validarCampo(campos, 2),
            indProc: validarCampo(campos, 3)
        };
    }

    function parseRegistroF120(campos) {
        if (!validarEstruturaRegistro(campos, 18)) return null;
        return {
            tipo: 'bens_ativo',
            categoria: 'ativo_imobilizado',
            natBcCred: validarCampo(campos, 2),
            identBemImob: validarCampo(campos, 3),
            indOrigCred: validarCampo(campos, 4),
            indUtilBemImob: validarCampo(campos, 5),
            valorOperacao: parseValorMonetario(validarCampo(campos, 6, '0')),
            parcCredito: parseValorMonetario(validarCampo(campos, 7, '0')),
            valorCredito: parseValorMonetario(validarCampo(campos, 8, '0')),
            dataOperacao: validarCampo(campos, 9)
        };
    }

    function parseRegistroF129(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'processo_referenciado',
            categoria: 'bens_ativo',
            numProc: validarCampo(campos, 2),
            indProc: validarCampo(campos, 3)
        };
    }

    function parseRegistroF130(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'atividade_imobiliaria',
            categoria: 'credito',
            natBcCred: validarCampo(campos, 2),
            valorBcPis: parseValorMonetario(validarCampo(campos, 3, '0')),
            valorPis: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorBcCofins: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorCofins: parseValorMonetario(validarCampo(campos, 6, '0')),
            infCompl: validarCampo(campos, 7)
        };
    }

    function parseRegistroF139(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'processo_referenciado',
            categoria: 'atividade_imobiliaria',
            numProc: validarCampo(campos, 2),
            indProc: validarCampo(campos, 3)
        };
    }

    function parseRegistroF150(campos) {
        if (!validarEstruturaRegistro(campos, 12)) return null;
        return {
            tipo: 'credito_presumido_estoque',
            categoria: 'credito',
            natBcCred: validarCampo(campos, 2),
            valorEstoque: parseValorMonetario(validarCampo(campos, 3, '0')),
            valorBcPis: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorPis: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorBcCofins: parseValorMonetario(validarCampo(campos, 6, '0')),
            valorCofins: parseValorMonetario(validarCampo(campos, 7, '0'))
        };
    }

    function parseRegistroF200(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'operacao_imobiliaria',
            categoria: 'receita',
            indOper: validarCampo(campos, 2),
            unidImob: validarCampo(campos, 3),
            identEmpr: validarCampo(campos, 4),
            descrUnidImob: validarCampo(campos, 5),
            numCont: validarCampo(campos, 6),
            cpfCnpjAdq: validarCampo(campos, 7),
            dataOper: validarCampo(campos, 8),
            valorTotalVenda: parseValorMonetario(validarCampo(campos, 9, '0')),
            valorRecebido: parseValorMonetario(validarCampo(campos, 10, '0'))
        };
    }

    function parseRegistroF205(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'operacao_cartao_credito',
            categoria: 'receita',
            valorOperacao: parseValorMonetario(validarCampo(campos, 2, '0')),
            valorDesconto: parseValorMonetario(validarCampo(campos, 3, '0')),
            valorBcPis: parseValorMonetario(validarCampo(campos, 4, '0')),
            aliqPis: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorPis: parseValorMonetario(validarCampo(campos, 6, '0')),
            valorBcCofins: parseValorMonetario(validarCampo(campos, 7, '0')),
            aliqCofins: parseValorMonetario(validarCampo(campos, 8, '0')),
            valorCofins: parseValorMonetario(validarCampo(campos, 9, '0'))
        };
    }

    function parseRegistroF210(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'cide',
            categoria: 'contribuicao',
            codCide: validarCampo(campos, 2),
            valorBcCide: parseValorMonetario(validarCampo(campos, 3, '0')),
            aliqCide: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorCide: parseValorMonetario(validarCampo(campos, 5, '0'))
        };
    }

    function parseRegistroF211(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'processo_referenciado',
            categoria: 'cide',
            numProc: validarCampo(campos, 2),
            indProc: validarCampo(campos, 3)
        };
    }

    function parseRegistroI100(campos) {
        if (!validarEstruturaRegistro(campos, 18)) return null;
        return {
            tipo: 'operacao_exterior',
            categoria: 'credito',
            valorReceita: parseValorMonetario(validarCampo(campos, 2, '0')),
            cstPis: validarCampo(campos, 3),
            valorBcPis: parseValorMonetario(validarCampo(campos, 4, '0')),
            aliqPis: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorPis: parseValorMonetario(validarCampo(campos, 6, '0')),
            cstCofins: validarCampo(campos, 7),
            valorBcCofins: parseValorMonetario(validarCampo(campos, 8, '0')),
            aliqCofins: parseValorMonetario(validarCampo(campos, 9, '0')),
            valorCofins: parseValorMonetario(validarCampo(campos, 10, '0'))
        };
    }

    function parseRegistroI199(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'processo_referenciado',
            categoria: 'operacao_exterior',
            numProc: validarCampo(campos, 2),
            indProc: validarCampo(campos, 3)
        };
    }

    function parseRegistroM100(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'credito',
            categoria: 'pis',
            codCredPres: validarCampo(campos, 2),
            valorCredito: parseValorMonetario(validarCampo(campos, 3, '0')),
            perCredPres: parseValorMonetario(validarCampo(campos, 4, '0')),
            origem: 'registro_m100'
        };
    }

    function parseRegistroM105(campos) {
        if (!validarEstruturaRegistro(campos, 9)) {
            console.warn('Registro M105 com estrutura insuficiente (esperado 9):', campos.length);
            return null;
        }

        try {
            return {
                tipo: 'credito_detalhe',
                categoria: 'pis',
                natBcCred: validarCampo(campos, 1),                              // Campo 02: NAT_BC_CRED
                cstPis: validarCampo(campos, 2),                                 // Campo 03: CST_PIS
                valorBcPisTotal: parseValorMonetario(validarCampo(campos, 3, '0')),   // Campo 04: VL_BC_PIS_TOT
                valorBcPisCum: parseValorMonetario(validarCampo(campos, 4, '0')),     // Campo 05: VL_BC_PIS_CUM
                valorBcPis: parseValorMonetario(validarCampo(campos, 5, '0')),        // Campo 06: VL_BC_PIS_NC
                valorCredito: parseValorMonetario(validarCampo(campos, 6, '0')),      // Campo 07: VL_CRED_PIS_UTIL
                valorCreditoTransferido: parseValorMonetario(validarCampo(campos, 7, '0')), // Campo 08: VL_CRED_PIS_TRANS
                codCta: validarCampo(campos, 8),                                // Campo 09: COD_CTA
                descricao: validarCampo(campos, 9, '')                          // Campo 10: DESC_CRED (se existir)
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M105:', erro.message);
            return null;
        }
    }

    function parseRegistroM110(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'ajuste',
            categoria: 'pis',
            indAjuste: validarCampo(campos, 2),
            valorAjuste: parseValorMonetario(validarCampo(campos, 3, '0')),
            codAjuste: validarCampo(campos, 4)
        };
    }

    function parseRegistroM115(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'detalhamento_ajuste',
            categoria: 'pis',
            detalhamentoAjuste: validarCampo(campos, 2),
            codCred: validarCampo(campos, 3),
            valorCredito: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroM200(campos) {
        if (!validarEstruturaRegistro(campos, 16)) {
            console.warn('Registro M200 com estrutura insuficiente:', campos.length, 'campos encontrados (esperado 16+)');
            return null;
        }

        try {
            return {
                tipo: 'debito',
                categoria: 'pis',
                valorTotalCreditosNoPeriodo: parseValorMonetario(validarCampo(campos, 3, '0')),  // Campo 03: VL_CRED_APR_NO_PER
                valorTotalCreditosRecebidos: parseValorMonetario(validarCampo(campos, 4, '0')),  // Campo 04: VL_CRED_RECEBIDO
                valorTotalCreditosApurados: parseValorMonetario(validarCampo(campos, 5, '0')),   // Campo 05: VL_TOT_CRED_APR
                valorRetidoNaFonte: parseValorMonetario(validarCampo(campos, 6, '0')),           // Campo 06: VL_CONTRIB_RET (NC)
                valorOutrasDeducoes: parseValorMonetario(validarCampo(campos, 7, '0')),          // Campo 07: VL_TOT_DED (NC)
                valorContribNaoCumulativa: parseValorMonetario(validarCampo(campos, 8, '0')),    // Campo 08: VL_TOT_CONTRIB_NC
                valorTotalDebitos: parseValorMonetario(validarCampo(campos, 4, '0')),            // Campo 04: VL_TOT_DEB_APU_PER
                valorTotalCreditos: parseValorMonetario(validarCampo(campos, 6, '0')),           // Campo 06: VL_TOT_CRED_DESC_PER
                valorRetidoFonteCumulativo: parseValorMonetario(validarCampo(campos, 10, '0')),  // Campo 10: VL_CONTRIB_RET (C)
                valorDeducoesCumulativas: parseValorMonetario(validarCampo(campos, 11, '0')),    // Campo 11: VL_TOT_DED (C)
                valorContribCumulativa: parseValorMonetario(validarCampo(campos, 12, '0')),      // Campo 12: VL_TOT_CONTRIB_C
                valorTotalAjusteCredito: parseValorMonetario(validarCampo(campos, 13, '0')),     // Campo 13: VL_TOT_AJ_CREDITO
                valorSaldoCredorAnterior: parseValorMonetario(validarCampo(campos, 14, '0')),    // Campo 14: VL_SLD_CRED_ANT
                valorTotalContribApurada: parseValorMonetario(validarCampo(campos, 15, '0')),    // Campo 15: VL_TOT_CONTRIB_APUR
                valorSaldoCredorFinal: parseValorMonetario(validarCampo(campos, 16, '0')),       // Campo 16: VL_SLD_CRED_FIM
                registro: 'M200'
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M200:', erro.message);
            return null;
        }
    }

    function parseRegistroM205(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'ajuste_consolidacao',
            categoria: 'pis',
            numCampo: validarCampo(campos, 2),
            codAj: validarCampo(campos, 3),
            valorAjuste: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroM210(campos) {
        if (!validarEstruturaRegistro(campos, 16)) {
            console.warn('Registro M210 com estrutura insuficiente:', campos.length, 'campos encontrados (esperado 16+)');
            return null;
        }

        try {
            return {
                tipo: 'detalhamento_contribuicao',
                categoria: 'pis',
                codCont: validarCampo(campos, 2), // Campo 02: COD_CONT
                valorReceitaBruta: parseValorMonetario(validarCampo(campos, 3, '0')), // Campo 03: VL_REC_BRT
                valorBaseCalculoAntes: parseValorMonetario(validarCampo(campos, 4, '0')), // Campo 04: VL_BC_CONT (antes ajustes)

                // NOVOS CAMPOS DE AJUSTE
                valorAjustesAcrescimoBc: parseValorMonetario(validarCampo(campos, 5, '0')), // Campo 05: VL_AJUS_ACRES_BC_PIS
                valorAjustesReducaoBc: parseValorMonetario(validarCampo(campos, 6, '0')), // Campo 06: VL_AJUS_REDUC_BC_PIS
                valorBaseCalculoAjustada: parseValorMonetario(validarCampo(campos, 7, '0')), // Campo 07: VL_BC_CONT_AJUS

                // CAMPOS RENUMERADOS (eram 05-13, agora 08-16)
                aliqPis: parseFloat(validarCampo(campos, 8, '0').replace(',', '.')) || 0, // Campo 08: ALIQ_PIS
                quantBcPis: parseValorMonetario(validarCampo(campos, 9, '0')), // Campo 09: QUANT_BC_PIS
                aliqPisQuant: parseValorMonetario(validarCampo(campos, 10, '0')), // Campo 10: ALIQ_PIS_QUANT
                valorContribApurada: parseValorMonetario(validarCampo(campos, 11, '0')), // Campo 11: VL_CONT_APUR
                valorAjustesAcrescimo: parseValorMonetario(validarCampo(campos, 12, '0')), // Campo 12: VL_AJUS_ACRES
                valorAjustesReducao: parseValorMonetario(validarCampo(campos, 13, '0')), // Campo 13: VL_AJUS_REDUC
                valorContribDiferir: parseValorMonetario(validarCampo(campos, 14, '0')), // Campo 14: VL_CONT_DIFER
                valorContribDiferidaAnt: parseValorMonetario(validarCampo(campos, 15, '0')), // Campo 15: VL_CONT_DIFER_ANT
                valorContribPeriodo: parseValorMonetario(validarCampo(campos, 16, '0')), // Campo 16: VL_CONT_PER

                // Metadados
                registro: 'M210',
                versaoLayout: 'nova', // Identificar nova versão

                // Cálculos derivados
                baseCalculoOriginal: parseValorMonetario(validarCampo(campos, 4, '0')),
                baseCalculoFinal: parseValorMonetario(validarCampo(campos, 7, '0')),
                diferencaAjustes: parseValorMonetario(validarCampo(campos, 5, '0')) - parseValorMonetario(validarCampo(campos, 6, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M210:', erro.message);
            return null;
        }
    }

    function parseRegistroM220(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'demonstrativo_saldo_credor',
            categoria: 'pis',
            indAj: validarCampo(campos, 2),
            valorAj: parseValorMonetario(validarCampo(campos, 3, '0')),
            codAj: validarCampo(campos, 4)
        };
    }

    function parseRegistroM225(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'detalhamento_demonstrativo_pis',
            categoria: 'pis',
            numDoc: validarCampo(campos, 2),
            codItem: validarCampo(campos, 3),
            valorAj: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroM400(campos) {
        if (!validarEstruturaRegistro(campos, 5)) return null;
        return {
            tipo: 'receita_nao_tributada',
            categoria: 'pis',
            cstPis: validarCampo(campos, 2),
            valorTotRec: parseValorMonetario(validarCampo(campos, 3, '0')),
            codCta: validarCampo(campos, 4)
        };
    }

    function parseRegistroM410(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'detalhamento_receita_nao_tributada',
            categoria: 'pis',
            natRec: validarCampo(campos, 2),
            valorRec: parseValorMonetario(validarCampo(campos, 3, '0')),
            codCta: validarCampo(campos, 4),
            descrCompl: validarCampo(campos, 5)
        };
    }

    function parseRegistroM500(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'credito',
            categoria: 'cofins',
            codCredPres: validarCampo(campos, 2),
            valorCredito: parseValorMonetario(validarCampo(campos, 3, '0')),
            perCredPres: parseValorMonetario(validarCampo(campos, 4, '0')),
            origem: 'registro_m500'
        };
    }

    function parseRegistroM505(campos) {
        if (!validarEstruturaRegistro(campos, 9)) {
            console.warn('Registro M505 com estrutura insuficiente (esperado 9):', campos.length);
            return null;
        }
        try {
            return {
                tipo: 'credito_detalhe',
                categoria: 'cofins',
                natBcCred: validarCampo(campos, 1),                                 // Campo 02: NAT_BC_CRED
                cstCofins: validarCampo(campos, 2),                                 // Campo 03: CST_COFINS
                valorBcCofinsTotal: parseValorMonetario(validarCampo(campos, 3, '0')),   // Campo 04: VL_BC_COFINS_TOT
                valorBcCofinsCum: parseValorMonetario(validarCampo(campos, 4, '0')),     // Campo 05: VL_BC_COFINS_CUM
                valorBcCofins: parseValorMonetario(validarCampo(campos, 5, '0')),        // Campo 06: VL_BC_COFINS_NC
                valorCredito: parseValorMonetario(validarCampo(campos, 6, '0')),         // Campo 07: VL_CRED_COFINS_UTIL
                valorCreditoTransferido: parseValorMonetario(validarCampo(campos, 7, '0')), // Campo 08: VL_CRED_COFINS_TRANS
                codCta: validarCampo(campos, 8),                                   // Campo 09: COD_CTA
                descricao: validarCampo(campos, 9, '')                             // Campo 10: DESC_CRED (se existir)
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M505:', erro.message);
            return null;
        }
    }

    function parseRegistroM510(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'ajuste',
            categoria: 'cofins',
            indAjuste: validarCampo(campos, 2),
            valorAjuste: parseValorMonetario(validarCampo(campos, 3, '0')),
            codAjuste: validarCampo(campos, 4)
        };
    }

    function parseRegistroM515(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'detalhamento_ajuste',
            categoria: 'cofins',
            detalhamentoAjuste: validarCampo(campos, 2),
            codCred: validarCampo(campos, 3),
            valorCredito: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroM600(campos) {
        if (!validarEstruturaRegistro(campos, 16)) {
            console.warn('Registro M600 com estrutura insuficiente:', campos.length, 'campos encontrados (esperado 16+)');
            return null;
        }

        try {
            return {
                tipo: 'debito',
                categoria: 'cofins',
                valorTotalCreditosNoPeriodo: parseValorMonetario(validarCampo(campos, 3, '0')),  // Campo 03: VL_CRED_APR_NO_PER
                valorTotalCreditosRecebidos: parseValorMonetario(validarCampo(campos, 4, '0')),  // Campo 04: VL_CRED_RECEBIDO
                valorTotalCreditosApurados: parseValorMonetario(validarCampo(campos, 5, '0')),   // Campo 05: VL_TOT_CRED_APR
                valorRetidoNaFonte: parseValorMonetario(validarCampo(campos, 6, '0')),           // Campo 06: VL_CONTRIB_RET (NC)
                valorOutrasDeducoes: parseValorMonetario(validarCampo(campos, 7, '0')),          // Campo 07: VL_TOT_DED (NC)
                valorContribNaoCumulativa: parseValorMonetario(validarCampo(campos, 8, '0')),    // Campo 08: VL_TOT_CONTRIB_NC
                valorTotalDebitos: parseValorMonetario(validarCampo(campos, 4, '0')),            // Campo 04: VL_TOT_DEB_APU_PER
                valorTotalCreditos: parseValorMonetario(validarCampo(campos, 6, '0')),           // Campo 06: VL_TOT_CRED_DESC_PER
                valorRetidoFonteCumulativo: parseValorMonetario(validarCampo(campos, 10, '0')),  // Campo 10: VL_CONTRIB_RET (C)
                valorDeducoesCumulativas: parseValorMonetario(validarCampo(campos, 11, '0')),    // Campo 11: VL_TOT_DED (C)
                valorContribCumulativa: parseValorMonetario(validarCampo(campos, 12, '0')),      // Campo 12: VL_TOT_CONTRIB_C
                valorTotalAjusteCredito: parseValorMonetario(validarCampo(campos, 13, '0')),     // Campo 13: VL_TOT_AJ_CREDITO
                valorSaldoCredorAnterior: parseValorMonetario(validarCampo(campos, 14, '0')),    // Campo 14: VL_SLD_CRED_ANT
                valorTotalContribApurada: parseValorMonetario(validarCampo(campos, 15, '0')),    // Campo 15: VL_TOT_CONTRIB_APUR
                valorSaldoCredorFinal: parseValorMonetario(validarCampo(campos, 16, '0')),       // Campo 16: VL_SLD_CRED_FIM
                registro: 'M600'
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M600:', erro.message);
            return null;
        }
    }

    function parseRegistroM605(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'ajuste_consolidacao',
            categoria: 'cofins',
            numCampo: validarCampo(campos, 2),
            codAj: validarCampo(campos, 3),
            valorAjuste: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroM610(campos) {
        if (!validarEstruturaRegistro(campos, 16)) {
            console.warn('Registro M610 com estrutura insuficiente:', campos.length, 'campos encontrados (esperado 16+)');
            return null;
        }

        try {
            return {
                tipo: 'detalhamento_contribuicao',
                categoria: 'cofins',
                codCont: validarCampo(campos, 2), // Campo 02: COD_CONT
                valorReceitaBruta: parseValorMonetario(validarCampo(campos, 3, '0')), // Campo 03: VL_REC_BRT
                valorBaseCalculoAntes: parseValorMonetario(validarCampo(campos, 4, '0')), // Campo 04: VL_BC_CONT (antes ajustes)

                // NOVOS CAMPOS DE AJUSTE
                valorAjustesAcrescimoBc: parseValorMonetario(validarCampo(campos, 5, '0')), // Campo 05: VL_AJUS_ACRES_BC_COFINS
                valorAjustesReducaoBc: parseValorMonetario(validarCampo(campos, 6, '0')), // Campo 06: VL_AJUS_REDUC_BC_COFINS
                valorBaseCalculoAjustada: parseValorMonetario(validarCampo(campos, 7, '0')), // Campo 07: VL_BC_CONT_AJUS

                // CAMPOS RENUMERADOS (eram 05-13, agora 08-16)
                aliqCofins: parseFloat(validarCampo(campos, 8, '0').replace(',', '.')) || 0, // Campo 08: ALIQ_COFINS
                quantBcCofins: parseValorMonetario(validarCampo(campos, 9, '0')), // Campo 09: QUANT_BC_COFINS
                aliqCofinsQuant: parseValorMonetario(validarCampo(campos, 10, '0')), // Campo 10: ALIQ_COFINS_QUANT
                valorContribApurada: parseValorMonetario(validarCampo(campos, 11, '0')), // Campo 11: VL_CONT_APUR
                valorAjustesAcrescimo: parseValorMonetario(validarCampo(campos, 12, '0')), // Campo 12: VL_AJUS_ACRES
                valorAjustesReducao: parseValorMonetario(validarCampo(campos, 13, '0')), // Campo 13: VL_AJUS_REDUC
                valorContribDiferir: parseValorMonetario(validarCampo(campos, 14, '0')), // Campo 14: VL_CONT_DIFER
                valorContribDiferidaAnt: parseValorMonetario(validarCampo(campos, 15, '0')), // Campo 15: VL_CONT_DIFER_ANT
                valorContribPeriodo: parseValorMonetario(validarCampo(campos, 16, '0')), // Campo 16: VL_CONT_PER

                // Metadados
                registro: 'M610',
                versaoLayout: 'nova', // Identificar nova versão

                // Cálculos derivados
                baseCalculoOriginal: parseValorMonetario(validarCampo(campos, 4, '0')),
                baseCalculoFinal: parseValorMonetario(validarCampo(campos, 7, '0')),
                diferencaAjustes: parseValorMonetario(validarCampo(campos, 5, '0')) - parseValorMonetario(validarCampo(campos, 6, '0'))
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M610:', erro.message);
            return null;
        }
    }
    
    function parseRegistroM215(campos) {
        if (!validarEstruturaRegistro(campos, 10)) {
            console.warn('Registro M215 com estrutura insuficiente:', campos.length, 'campos encontrados (esperado 10+)');
            return null;
        }

        try {
            return {
                tipo: 'ajuste_base_calculo',
                categoria: 'pis',
                indAjusteBc: validarCampo(campos, 2), // Campo 02: IND_AJ_BC (0=acréscimo, 1=redução)
                valorAjusteBc: parseValorMonetario(validarCampo(campos, 3, '0')), // Campo 03: VL_AJ_BC
                codAjusteBc: validarCampo(campos, 4), // Campo 04: COD_AJ_BC
                numDoc: validarCampo(campos, 5), // Campo 05: NUM_DOC
                descrAjusteBc: validarCampo(campos, 6), // Campo 06: DESCR_AJ_BC
                dataRef: validarCampo(campos, 7), // Campo 07: DT_REF
                codCta: validarCampo(campos, 8), // Campo 08: COD_CTA
                cnpj: validarCampo(campos, 9), // Campo 09: CNPJ
                infoCompl: validarCampo(campos, 10), // Campo 10: INFO_COMPL

                // Campos derivados
                tipoAjuste: validarCampo(campos, 2) === '0' ? 'acrescimo' : 'reducao',
                registro: 'M215',
                hierarquia: 4 // Registro filho de M210
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M215:', erro.message);
            return null;
        }
    }

    function parseRegistroM615(campos) {
        if (!validarEstruturaRegistro(campos, 10)) {
            console.warn('Registro M615 com estrutura insuficiente:', campos.length, 'campos encontrados (esperado 10+)');
            return null;
        }

        try {
            return {
                tipo: 'ajuste_base_calculo',
                categoria: 'cofins',
                indAjusteBc: validarCampo(campos, 2), // Campo 02: IND_AJ_BC (0=acréscimo, 1=redução)
                valorAjusteBc: parseValorMonetario(validarCampo(campos, 3, '0')), // Campo 03: VL_AJ_BC
                codAjusteBc: validarCampo(campos, 4), // Campo 04: COD_AJ_BC
                numDoc: validarCampo(campos, 5), // Campo 05: NUM_DOC
                descrAjusteBc: validarCampo(campos, 6), // Campo 06: DESCR_AJ_BC
                dataRef: validarCampo(campos, 7), // Campo 07: DT_REF
                codCta: validarCampo(campos, 8), // Campo 08: COD_CTA
                cnpj: validarCampo(campos, 9), // Campo 09: CNPJ
                infoCompl: validarCampo(campos, 10), // Campo 10: INFO_COMPL

                // Campos derivados
                tipoAjuste: validarCampo(campos, 2) === '0' ? 'acrescimo' : 'reducao',
                registro: 'M615',
                hierarquia: 4 // Registro filho de M610
            };
        } catch (erro) {
            console.warn('Erro ao processar registro M615:', erro.message);
            return null;
        }
    }

    function parseRegistroM620(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'demonstrativo_saldo_credor',
            categoria: 'cofins',
            indAj: validarCampo(campos, 2),
            valorAj: parseValorMonetario(validarCampo(campos, 3, '0')),
            codAj: validarCampo(campos, 4)
        };
    }

    function parseRegistroM625(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'detalhamento_demonstrativo_cofins',
            categoria: 'cofins',
            numDoc: validarCampo(campos, 2),
            codItem: validarCampo(campos, 3),
            valorAj: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroM800(campos) {
        if (!validarEstruturaRegistro(campos, 5)) return null;
        return {
            tipo: 'receita_nao_tributada',
            categoria: 'cofins',
            cstCofins: validarCampo(campos, 2),
            valorTotRec: parseValorMonetario(validarCampo(campos, 3, '0')),
            codCta: validarCampo(campos, 4)
        };
    }

    function parseRegistroM810(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'detalhamento_receita_nao_tributada',
            categoria: 'cofins',
            natRec: validarCampo(campos, 2),
            valorRec: parseValorMonetario(validarCampo(campos, 3, '0')),
            codCta: validarCampo(campos, 4),
            descrCompl: validarCampo(campos, 5)
        };
    }

    function parseRegistroP100(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'contribuicao_previdenciaria',
            categoria: 'previdenciaria',
            valorBcCp: parseValorMonetario(validarCampo(campos, 2, '0')),
            aliqCp: parseValorMonetario(validarCampo(campos, 3, '0')),
            valorCp: parseValorMonetario(validarCampo(campos, 4, '0')),
            codCta: validarCampo(campos, 5),
            descrCompl: validarCampo(campos, 6)
        };
    }

    function parseRegistroP110(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'ajuste_contribuicao_previdenciaria',
            categoria: 'previdenciaria',
            numCampo: validarCampo(campos, 2),
            codAj: validarCampo(campos, 3),
            valorAjuste: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroP199(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'processo_referenciado',
            categoria: 'contribuicao_previdenciaria',
            numProc: validarCampo(campos, 2),
            indProc: validarCampo(campos, 3)
        };
    }

    function parseRegistroP200(campos) {
        if (!validarEstruturaRegistro(campos, 10)) return null;
        return {
            tipo: 'consolidacao_contribuicao_previdenciaria',
            categoria: 'previdenciaria',
            valorTotalCp: parseValorMonetario(validarCampo(campos, 2, '0')),
            valorTotalAjuste: parseValorMonetario(validarCampo(campos, 3, '0')),
            valorApagar: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroP210(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'ajuste_consolidacao_previdenciaria',
            categoria: 'previdenciaria',
            numCampo: validarCampo(campos, 2),
            codAj: validarCampo(campos, 3),
            valorAjuste: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistro1001(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'encerramento',
            indMov: validarCampo(campos, 2)
        };
    }

    function parseRegistro1100(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'totalizacao',
            categoria: 'pis',
            perApur: validarCampo(campos, 2),
            valorRecBrt: parseValorMonetario(validarCampo(campos, 3, '0')),
            valorBcPis: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorPis: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorCredPis: parseValorMonetario(validarCampo(campos, 6, '0')),
            valorContribPis: parseValorMonetario(validarCampo(campos, 7, '0'))
        };
    }

    function parseRegistro1200(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'totalizacao',
            categoria: 'cofins',
            perApur: validarCampo(campos, 2),
            valorRecBrt: parseValorMonetario(validarCampo(campos, 3, '0')),
            valorBcCofins: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorCofins: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorCredCofins: parseValorMonetario(validarCampo(campos, 6, '0')),
            valorContribCofins: parseValorMonetario(validarCampo(campos, 7, '0'))
        };
    }

    function parseRegistro1300(campos) {
        if (!validarEstruturaRegistro(campos, 10)) return null;
        return {
            tipo: 'totalizacao',
            categoria: 'previdenciaria',
            perApur: validarCampo(campos, 2),
            valorTotContPrev: parseValorMonetario(validarCampo(campos, 3, '0')),
            valorTotFol: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorExcBcCont: parseValorMonetario(validarCampo(campos, 5, '0'))
        };
    }

    function parseRegistro1500(campos) {
        if (!validarEstruturaRegistro(campos, 25)) return null;
        return {
            tipo: 'totalizacao',
            categoria: 'geral',
            perApur: validarCampo(campos, 2),
            valorRecTribMI: parseValorMonetario(validarCampo(campos, 3, '0')),
            valorRecNTribMI: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorRecExp: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorRecTotExt: parseValorMonetario(validarCampo(campos, 6, '0'))
        };
    }

    // =============================
    // FUNÇÕES DE PARSING - ECF
    // =============================

    function parseRegistro0000ECF(campos) {
        if (!validarEstruturaRegistro(campos, 11)) return null;
        return {
            tipo: 'empresa',
            nome: validarCampo(campos, 7),
            cnpj: validarCampo(campos, 6),
            dataInicial: validarCampo(campos, 4),
            dataFinal: validarCampo(campos, 5),
            situacaoEspecial: validarCampo(campos, 8),
            eventoSitEsp: validarCampo(campos, 9),
            naturezaLivro: validarCampo(campos, 10),
            finalidadeEscr: validarCampo(campos, 11)
        };
    }

    function parseRegistro0010ECF(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'hash_arquivo',
            hash: validarCampo(campos, 2),
            arquivoRtf: validarCampo(campos, 3),
            indSitEsp: validarCampo(campos, 4)
        };
    }

    function parseRegistro0020ECF(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'empresa_detalhes',
            indAlteracaoPC: validarCampo(campos, 2),
            codIncidencia: validarCampo(campos, 3),
            indApExt: validarCampo(campos, 4),
            indCPC: validarCampo(campos, 5),
            codVersao: validarCampo(campos, 6),
            codEntRef: validarCampo(campos, 7)
        };
    }

    function parseRegistroJ001ECF(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            bloco: 'J',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroJ050ECF(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'dre',
            codConta: validarCampo(campos, 2),
            descrConta: validarCampo(campos, 3),
            valorConta: parseValorMonetario(validarCampo(campos, 4, '0')),
            indDC: validarCampo(campos, 5)
        };
    }

    // =============================
    // REGISTROS DE CONTROLE E ENCERRAMENTO - SPED FISCAL
    // =============================

    function parseRegistro9900(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'totalizacao_registro',
            categoria: 'controle',
            regBlc: validarCampo(campos, 2),
            qtdRegBlc: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistro9990(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'encerramento_bloco',
            categoria: 'controle',
            qtdLin9: parseValorMonetario(validarCampo(campos, 2, '0'))
        };
    }

    function parseRegistro9999(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'encerramento_arquivo',
            categoria: 'controle',
            qtdLin: parseValorMonetario(validarCampo(campos, 2, '0'))
        };
    }

    // =============================
    // FUNÇÕES DE PARSING - SPED ECF
    // =============================

    function parseRegistroJ051ECF(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'plano_contas_referencial',
            categoria: 'conta_referencial',
            codConta: validarCampo(campos, 2),
            codContaRef: validarCampo(campos, 3),
            descrConta: validarCampo(campos, 4)
        };
    }

    function parseRegistroJ100ECF(campos) {
        if (!validarEstruturaRegistro(campos, 5)) return null;
        return {
            tipo: 'centro_custo',
            categoria: 'centro_custo',
            dataAlt: validarCampo(campos, 2),
            codCcus: validarCampo(campos, 3),
            descrCcus: validarCampo(campos, 4)
        };
    }

    function parseRegistroK001ECF(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'saldos_contabeis',
            bloco: 'K',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroK030ECF(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'periodo_apuracao',
            categoria: 'identificacao_periodo',
            dataIni: validarCampo(campos, 2),
            dataFim: validarCampo(campos, 3)
        };
    }

    function parseRegistroK155ECF(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'saldo_contabil',
            categoria: 'saldo_final',
            codConta: validarCampo(campos, 2),
            codCcus: validarCampo(campos, 3),
            valorSaldo: parseValorMonetario(validarCampo(campos, 4, '0')),
            indDC: validarCampo(campos, 5)
        };
    }

    function parseRegistroK156ECF(campos) {
        if (!validarEstruturaRegistro(campos, 5)) return null;
        return {
            tipo: 'mapeamento_referencial',
            categoria: 'saldo_final',
            codConta: validarCampo(campos, 2),
            codContaRef: validarCampo(campos, 3),
            valorSaldo: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroL001ECF(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'lalur_lacs',
            bloco: 'L',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroL030ECF(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'periodo_lalur',
            categoria: 'identificacao_periodo',
            dataIni: validarCampo(campos, 2),
            dataFim: validarCampo(campos, 3)
        };
    }

    function parseRegistroL100ECF(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'demonstracao_lucro',
            categoria: 'lalur',
            codConta: validarCampo(campos, 2),
            descrConta: validarCampo(campos, 3),
            valorConta: parseValorMonetario(validarCampo(campos, 4, '0')),
            indDC: validarCampo(campos, 5)
        };
    }

    function parseRegistroM001ECF(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'lalur_lacs',
            bloco: 'M',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroM010ECF(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'conta_parte_b',
            categoria: 'lalur_lacs',
            codConta: validarCampo(campos, 2),
            descrConta: validarCampo(campos, 3),
            sinalConta: validarCampo(campos, 4)
        };
    }

    function parseRegistroM300ECF(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'demonstracao_lucro_real',
            categoria: 'lalur',
            codLinha: validarCampo(campos, 2),
            descrLinha: validarCampo(campos, 3),
            valorLinha: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroM350ECF(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'demonstracao_csll',
            categoria: 'lacs',
            codLinha: validarCampo(campos, 2),
            descrLinha: validarCampo(campos, 3),
            valorLinha: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroN001ECF(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'informacoes_diversas',
            bloco: 'N',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroN500ECF(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'credito_imposto_exterior',
            categoria: 'imposto_exterior',
            paisOrigem: validarCampo(campos, 2),
            valorImposto: parseValorMonetario(validarCampo(campos, 3, '0')),
            tipoRendimento: validarCampo(campos, 4)
        };
    }

    function parseRegistroN600ECF(campos) {
        if (!validarEstruturaRegistro(campos, 12)) return null;
        return {
            tipo: 'consolidacao_exterior',
            categoria: 'exterior',
            paisDestino: validarCampo(campos, 2),
            valorOperacao: parseValorMonetario(validarCampo(campos, 3, '0')),
            tipoOperacao: validarCampo(campos, 4)
        };
    }

    function parseRegistroN610ECF(campos) {
        if (!validarEstruturaRegistro(campos, 10)) return null;
        return {
            tipo: 'detalhe_exterior',
            categoria: 'exterior',
            codOperacao: validarCampo(campos, 2),
            valorDetalhado: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistroN620ECF(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'pessoa_vinculada_exterior',
            categoria: 'exterior',
            nomeVinculada: validarCampo(campos, 2),
            paisVinculada: validarCampo(campos, 3),
            valorVinculada: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroN630ECF(campos) {
        if (!validarEstruturaRegistro(campos, 12)) return null;
        return {
            tipo: 'preco_transferencia',
            categoria: 'exterior',
            metodoPrecificacao: validarCampo(campos, 2),
            valorAjuste: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistroN650ECF(campos) {
        if (!validarEstruturaRegistro(campos, 10)) return null;
        return {
            tipo: 'consolidacao_pais',
            categoria: 'exterior',
            codPais: validarCampo(campos, 2),
            valorConsolidado: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistroN660ECF(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'detalhamento_pais',
            categoria: 'exterior',
            tipoOperacaoPais: validarCampo(campos, 2),
            valorPais: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistroN670ECF(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'complemento_exterior',
            categoria: 'exterior',
            informacaoComplementar: validarCampo(campos, 2),
            valorComplemento: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistroP001ECF(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'rendimentos_exterior',
            bloco: 'P',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroP030ECF(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'periodo_rendimento',
            categoria: 'identificacao_periodo',
            dataIni: validarCampo(campos, 2),
            dataFim: validarCampo(campos, 3)
        };
    }

    function parseRegistroP100ECF(campos) {
        if (!validarEstruturaRegistro(campos, 12)) return null;
        return {
            tipo: 'rendimento_exterior',
            categoria: 'rendimento',
            paisOrigem: validarCampo(campos, 2),
            valorRendimento: parseValorMonetario(validarCampo(campos, 3, '0')),
            tipoRendimento: validarCampo(campos, 4)
        };
    }

    function parseRegistroP130ECF(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'imposto_exterior_pago',
            categoria: 'imposto_pago',
            paisImposto: validarCampo(campos, 2),
            valorImposto: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistroP150ECF(campos) {
        if (!validarEstruturaRegistro(campos, 10)) return null;
        return {
            tipo: 'credito_compensavel',
            categoria: 'credito',
            valorCredito: parseValorMonetario(validarCampo(campos, 2, '0')),
            anoCredito: validarCampo(campos, 3)
        };
    }

    function parseRegistroP200ECF(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'consolidacao_rendimento',
            categoria: 'rendimento',
            totalRendimentos: parseValorMonetario(validarCampo(campos, 2, '0')),
            totalImpostos: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistroP230ECF(campos) {
        if (!validarEstruturaRegistro(campos, 12)) return null;
        return {
            tipo: 'demonstrativo_credito',
            categoria: 'credito',
            creditoDisponivel: parseValorMonetario(validarCampo(campos, 2, '0')),
            creditoUtilizado: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistroT001ECF(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'rubricas_receita',
            bloco: 'T',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroT030ECF(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'periodo_rubrica',
            categoria: 'identificacao_periodo',
            dataIni: validarCampo(campos, 2),
            dataFim: validarCampo(campos, 3)
        };
    }

    function parseRegistroT120ECF(campos) {
        if (!validarEstruturaRegistro(campos, 10)) return null;
        return {
            tipo: 'rubrica_receita',
            categoria: 'receita',
            codRubrica: validarCampo(campos, 2),
            descrRubrica: validarCampo(campos, 3),
            valorRubrica: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroT150ECF(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'deducao_receita',
            categoria: 'deducao',
            codDeducao: validarCampo(campos, 2),
            valorDeducao: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistroU001ECF(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'demais_informacoes',
            bloco: 'U',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroU030ECF(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'periodo_informacao',
            categoria: 'identificacao_periodo',
            dataIni: validarCampo(campos, 2),
            dataFim: validarCampo(campos, 3)
        };
    }

    function parseRegistroU100ECF(campos) {
        if (!validarEstruturaRegistro(campos, 12)) return null;
        return {
            tipo: 'informacao_adicional',
            categoria: 'informacao',
            codInfo: validarCampo(campos, 2),
            descrInfo: validarCampo(campos, 3),
            valorInfo: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroY540ECF(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        console.warn('SPED-PARSER: Registro Y540 foi descontinuado no leiaute 7 da ECF (dezembro 2020)');
        return {
            tipo: 'receita_vendas_descontinuado',
            categoria: 'vendas',
            codAtividade: validarCampo(campos, 2),
            valorVendas: parseValorMonetario(validarCampo(campos, 3, '0')),
            observacao: 'Registro descontinuado - Leiaute 7'
        };
    }

    // =============================
    // FUNÇÕES DE PARSING - SPED ECD
    // =============================

    function parseRegistro0000ECD(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'empresa',
            categoria: 'identificacao',
            cnpj: validarCampo(campos, 8),
            nome: validarCampo(campos, 9),
            dataInicial: validarCampo(campos, 5),
            dataFinal: validarCampo(campos, 6),
            versaoLeiaute: validarCampo(campos, 3)
        };
    }

    function parseRegistro0001ECD(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'identificacao',
            bloco: '0',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistro0007ECD(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;
        return {
            tipo: 'entidade_empresarial',
            categoria: 'identificacao',
            codEntRef: validarCampo(campos, 2),
            codCcm: validarCampo(campos, 3),
            codScp: validarCampo(campos, 4)
        };
    }

    function parseRegistro0020ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'escrituracao_contabil',
            categoria: 'identificacao',
            indSitEsp: validarCampo(campos, 2),
            dtSitEsp: validarCampo(campos, 3),
            numRec: validarCampo(campos, 4)
        };
    }

    function parseRegistroI001ECD(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'lancamentos',
            bloco: 'I',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroI010ECD(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'identificacao_escrituracao',
            categoria: 'escrituracao',
            indEsc: validarCampo(campos, 2),
            codVerLc: validarCampo(campos, 3),
            nomeLivro: validarCampo(campos, 4)
        };
    }

    function parseRegistroI012ECD(campos) {
        if (!validarEstruturaRegistro(campos, 5)) return null;
        return {
            tipo: 'livros_auxiliares',
            categoria: 'escrituracao',
            numOrdLivro: validarCampo(campos, 2),
            natLivro: validarCampo(campos, 3),
            tipoEsc: validarCampo(campos, 4)
        };
    }

    function parseRegistroI015ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'identificacao_conta',
            categoria: 'conta',
            codCtaSup: validarCampo(campos, 2),
            codCta: validarCampo(campos, 3),
            nomeCta: validarCampo(campos, 4),
            codEcdRef: validarCampo(campos, 5)
        };
    }

    function parseRegistroI020ECD(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'abertura_comparativo',
            categoria: 'comparativo',
            regEcd: validarCampo(campos, 2),
            hashEcd: validarCampo(campos, 3),
            numOrdEcd: validarCampo(campos, 4)
        };
    }

    function parseRegistroI030ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'termo_abertura',
            categoria: 'termo',
            numOrd: validarCampo(campos, 2),
            natLivro: validarCampo(campos, 3),
            qtdLinhas: parseValorMonetario(validarCampo(campos, 4, '0')),
            nomeCidade: validarCampo(campos, 5),
            dataAbert: validarCampo(campos, 6),
            numInscr: validarCampo(campos, 7)
        };
    }

    function parseRegistroI050ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'dados_balancos',
            categoria: 'balanco',
            dataMovto: validarCampo(campos, 2),
            codCta: validarCampo(campos, 3),
            valorDebito: parseValorMonetario(validarCampo(campos, 4, '0')),
            valorCredito: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorSaldo: parseValorMonetario(validarCampo(campos, 6, '0')),
            indDCCred: validarCampo(campos, 7)
        };
    }

    function parseRegistroI051ECD(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'plano_contas_referencial_ecd',
            categoria: 'plano_contas',
            codEcdRef: validarCampo(campos, 2),
            codCtaRef: validarCampo(campos, 3),
            codSubCtaRef: validarCampo(campos, 4)
        };
    }

    function parseRegistroI052ECD(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'indicacao_codigo',
            categoria: 'codigo',
            codCcus: validarCampo(campos, 2),
            codCta: validarCampo(campos, 3),
            valorSaldo: parseValorMonetario(validarCampo(campos, 4, '0'))
        };
    }

    function parseRegistroI053ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'subconta_correlata',
            categoria: 'subconta',
            codIdent: validarCampo(campos, 2),
            codCtaCorr: validarCampo(campos, 3),
            nomeCta: validarCampo(campos, 4)
        };
    }

    function parseRegistroI100ECD(campos) {
        if (!validarEstruturaRegistro(campos, 7)) return null;
        return {
            tipo: 'centro_custo_ecd',
            categoria: 'centro_custo',
            dataAlt: validarCampo(campos, 2),
            codCcus: validarCampo(campos, 3),
            nomeCcus: validarCampo(campos, 4)
        };
    }

    function parseRegistroI150ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'saldo_periodo',
            categoria: 'saldo',
            dataIni: validarCampo(campos, 2),
            dataFim: validarCampo(campos, 3),
            codCta: validarCampo(campos, 4),
            valorDebito: parseValorMonetario(validarCampo(campos, 5, '0')),
            valorCredito: parseValorMonetario(validarCampo(campos, 6, '0'))
        };
    }

    function parseRegistroI155ECD(campos) {
        if (!validarEstruturaRegistro(campos, 9)) return null;
        return {
            tipo: 'detalhe_saldo_contabil',
            categoria: 'saldo_detalhado',
            codCta: validarCampo(campos, 2),
            codCcus: validarCampo(campos, 3),
            valorSaldoIni: parseValorMonetario(validarCampo(campos, 4, '0')),
            indDCSaldoIni: validarCampo(campos, 5),
            valorSaldoFim: parseValorMonetario(validarCampo(campos, 6, '0')),
            indDCSaldoFim: validarCampo(campos, 7)
        };
    }

    function parseRegistroI200ECD(campos) {
        if (!validarEstruturaRegistro(campos, 15)) return null;

        try {
            return {
                tipo: 'lancamento_contabil',
                categoria: 'lancamento',
                numLanc: validarCampo(campos, 2), // Número do lançamento
                dataLanc: validarCampo(campos, 3), // Data do lançamento
                valorLanc: parseValorMonetario(validarCampo(campos, 4, '0')), // Valor do lançamento
                indLanc: validarCampo(campos, 5), // Indicador do tipo de lançamento
                descrLanc: validarCampo(campos, 6), // Descrição do lançamento
                codHist: validarCampo(campos, 7), // Código do histórico
                descrHist: validarCampo(campos, 8), // Descrição do histórico
                descrCompl: validarCampo(campos, 9) // Descrição complementar
                // ✅ Observação: código da conta está no registro I250 (partidas)
            };
        } catch (erro) {
            console.warn('Erro ao processar registro I200:', erro.message);
            return null;
        }
    }

    function parseRegistroI250ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;

        try {
            return {
                tipo: 'partida_lancamento',
                categoria: 'partida',
                codCta: validarCampo(campos, 2), // ✅ Código da conta contábil (estava sendo buscado erroneamente no I200)
                codCcus: validarCampo(campos, 3), // Código do centro de custos
                valorPartida: parseValorMonetario(validarCampo(campos, 4, '0')), // Valor da partida
                indDC: validarCampo(campos, 5), // Indicador D/C
                numLinea: validarCampo(campos, 6) // Número da linha
            };
        } catch (erro) {
            console.warn('Erro ao processar registro I250:', erro.message);
            return null;
        }
    }

    function parseRegistroI300ECD(campos) {
        if (!validarEstruturaRegistro(campos, 12)) return null;
        return {
            tipo: 'balancete_verificacao',
            categoria: 'balancete',
            dataBalancete: validarCampo(campos, 2),
            codCta: validarCampo(campos, 3),
            valorSaldoIni: parseValorMonetario(validarCampo(campos, 4, '0')),
            indDCSaldoIni: validarCampo(campos, 5),
            valorDebito: parseValorMonetario(validarCampo(campos, 6, '0')),
            valorCredito: parseValorMonetario(validarCampo(campos, 7, '0')),
            valorSaldoFim: parseValorMonetario(validarCampo(campos, 8, '0')),
            indDCSaldoFim: validarCampo(campos, 9)
        };
    }

    function parseRegistroI310ECD(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'indicacao_grau_balancete',
            categoria: 'balancete',
            codEcdRef: validarCampo(campos, 2),
            codSubCtaCorr: validarCampo(campos, 3)
        };
    }

    function parseRegistroI350ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'resultado_periodo',
            categoria: 'resultado',
            dataResIni: validarCampo(campos, 2),
            dataResFim: validarCampo(campos, 3),
            codCta: validarCampo(campos, 4),
            valorSaldoFim: parseValorMonetario(validarCampo(campos, 5, '0')),
            indDCSaldoFim: validarCampo(campos, 6)
        };
    }

    function parseRegistroI355ECD(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'resultado_centro_custo',
            categoria: 'resultado',
            codCcus: validarCampo(campos, 2),
            valorResultado: parseValorMonetario(validarCampo(campos, 3, '0')),
            indDCRes: validarCampo(campos, 4)
        };
    }

    function parseRegistroJ001ECD(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'demonstracoes_contabeis',
            bloco: 'J',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroJ005ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'demonstracao_resultado',
            categoria: 'demonstracao',
            dataIni: validarCampo(campos, 2),
            dataFim: validarCampo(campos, 3),
            idDem: validarCampo(campos, 4),
            cabDem: validarCampo(campos, 5)
        };
    }

    function parseRegistroJ100ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'balanco_patrimonial',
            categoria: 'balanco',
            codAgl: validarCampo(campos, 2),
            nomeAgl: validarCampo(campos, 3),
            codAglSup: validarCampo(campos, 4),
            valorAgl: parseValorMonetario(validarCampo(campos, 5, '0')),
            indDCAgl: validarCampo(campos, 6)
        };
    }

    function parseRegistroJ150ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'demonstracao_resultado_exercicio',
            categoria: 'dre',
            codAgl: validarCampo(campos, 2),
            nomeAgl: validarCampo(campos, 3),
            codAglSup: validarCampo(campos, 4),
            valorAgl: parseValorMonetario(validarCampo(campos, 5, '0')),
            indDCAgl: validarCampo(campos, 6)
        };
    }

    function parseRegistroK001ECD(campos) {
        if (!validarEstruturaRegistro(campos, 3)) return null;
        return {
            tipo: 'abertura_bloco',
            categoria: 'conglomerados',
            bloco: 'K',
            indicadorMovimento: validarCampo(campos, 2)
        };
    }

    function parseRegistroK030ECD(campos) {
        if (!validarEstruturaRegistro(campos, 4)) return null;
        return {
            tipo: 'periodo_consolidacao',
            categoria: 'consolidacao',
            dataIni: validarCampo(campos, 2),
            dataFim: validarCampo(campos, 3)
        };
    }

    function parseRegistroK100ECD(campos) {
        if (!validarEstruturaRegistro(campos, 5)) {
            console.warn('Registro K100 ECD com estrutura insuficiente:', campos.length);
            return null;
        }

        try {
            const dataInicial = validarCampo(campos, 3);
            const dataFinal = validarCampo(campos, 4);

            return {
                tipo: 'periodo_apuracao',
                categoria: 'ciclo_financeiro',
                dataInicial: dataInicial,
                dataFinal: dataFinal,
                diasPeriodo: calcularDiasPeriodo(dataInicial, dataFinal),
                origem: 'K100_ECD'
            };
        } catch (erro) {
            console.warn('Erro ao processar registro K100 ECD:', erro.message);
            return null;
        }
    }

    // Função auxiliar para calcular dias do período
    function calcularDiasPeriodo(dataIni, dataFim) {
        if (!dataIni || !dataFim || dataIni.length !== 8 || dataFim.length !== 8) {
            return 0;
        }

        try {
            const inicio = new Date(
                dataIni.substr(0, 4),
                parseInt(dataIni.substr(4, 2)) - 1,
                dataIni.substr(6, 2)
            );
            const fim = new Date(
                dataFim.substr(0, 4),
                parseInt(dataFim.substr(4, 2)) - 1,
                dataFim.substr(6, 2)
            );

            return Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24));
        } catch (erro) {
            console.warn('Erro ao calcular dias do período:', erro.message);
            return 0;
        }
    }
    
    function calcularCiclosFinanceiros(resultado) {
        try {
            const dadosK100 = resultado.detalhamento?.periodo_apuracao || [];
            const dadosH005 = resultado.inventario || [];
            const dadosC170 = resultado.itens || [];

            if (dadosK100.length === 0) {
                console.warn('Dados K100 não encontrados para cálculo de ciclos');
                return null;
            }

            const periodo = dadosK100[0];
            const diasPeriodo = periodo.diasPeriodo || 30;

            // Calcular PME (Prazo Médio de Estocagem)
            const estoqueTotal = dadosH005.reduce((acc, item) => acc + (item.valorItem || 0), 0);
            const cmv = dadosC170.reduce((acc, item) => acc + (item.valorTotal || 0), 0);
            const pme = cmv > 0 ? (estoqueTotal / cmv) * diasPeriodo : 0;

            // Calcular PMR (Prazo Médio de Recebimento) - baseado em vendas a prazo
            const vendasTotal = dadosC170.reduce((acc, item) => acc + (item.valorTotal || 0), 0);
            const contasReceber = vendasTotal * 0.7; // Estimativa de 70% a prazo
            const pmr = vendasTotal > 0 ? (contasReceber / vendasTotal) * diasPeriodo : 0;

            // Calcular PMP (Prazo Médio de Pagamento) - baseado em compras
            const comprasTotal = dadosC170
                .filter(item => item.indMov === '0') // Apenas entradas
                .reduce((acc, item) => acc + (item.valorTotal || 0), 0);
            const contasPagar = comprasTotal * 0.6; // Estimativa de 60% a prazo
            const pmp = comprasTotal > 0 ? (contasPagar / comprasTotal) * diasPeriodo : 0;

            // Calcular Ciclo Financeiro
            const cicloFinanceiro = pme + pmr - pmp;

            return {
                pme: Math.round(pme),
                pmr: Math.round(pmr),
                pmp: Math.round(pmp),
                cicloFinanceiro: Math.round(cicloFinanceiro),
                diasPeriodo: diasPeriodo,
                observacoes: {
                    estoqueTotal: estoqueTotal,
                    cmv: cmv,
                    vendasTotal: vendasTotal,
                    comprasTotal: comprasTotal
                }
            };

        } catch (erro) {
            console.warn('Erro ao calcular ciclos financeiros:', erro.message);
            return null;
        }
    }
  
    // Adicionalmente, implementar K100 para EFD ICMS/IPI
    function parseRegistroK100Fiscal(campos) {
        if (!validarEstruturaRegistro(campos, 5)) return null;

        return {
            tipo: 'periodo_apuracao_fiscal',
            categoria: 'icms_ipi',
            dataInicial: validarCampo(campos, 3),
            dataFinal: validarCampo(campos, 4),
            origem: 'K100_FISCAL'
        };
    }

    function parseRegistroK155ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'evento_societario',
            categoria: 'consolidacao',
            codEvento: validarCampo(campos, 2),
            dataEvento: validarCampo(campos, 3),
            descrEvento: validarCampo(campos, 4)
        };
    }

    function parseRegistroK156ECD(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'empresa_evento',
            categoria: 'consolidacao',
            codEmpresaEvento: validarCampo(campos, 2),
            valorEvento: parseValorMonetario(validarCampo(campos, 3, '0'))
        };
    }

    function parseRegistroK200ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'plano_contas_consolidado',
            categoria: 'plano_contas_consolidado',
            codCtaConsolidada: validarCampo(campos, 2),
            nomeCtaConsolidada: validarCampo(campos, 3),
            codCtaSup: validarCampo(campos, 4)
        };
    }

    function parseRegistroK220ECD(campos) {
        if (!validarEstruturaRegistro(campos, 6)) return null;
        return {
            tipo: 'mapeamento_consolidacao',
            categoria: 'mapeamento',
            codEmpresaMap: validarCampo(campos, 2),
            codCtaEmpresa: validarCampo(campos, 3),
            codCtaConsolidada: validarCampo(campos, 4)
        };
    }

    function parseRegistroK230ECD(campos) {
        if (!validarEstruturaRegistro(campos, 8)) return null;
        return {
            tipo: 'saldo_consolidado',
            categoria: 'saldo_consolidado',
            codCtaConsolidada: validarCampo(campos, 2),
            valorSaldoConsolidado: parseValorMonetario(validarCampo(campos, 3, '0')),
            indDCSaldoConsolidado: validarCampo(campos, 4)
        };
    }

    function parseRegistroK300ECD(campos) {
        if (!validarEstruturaRegistro(campos, 12)) return null;
        return {
            tipo: 'eliminacao_consolidacao',
            categoria: 'eliminacao',
            codEliminacao: validarCampo(campos, 2),
            descrEliminacao: validarCampo(campos, 3),
            valorEliminacao: parseValorMonetario(validarCampo(campos, 4, '0')),
            codEmpresaOrigemElim: validarCampo(campos, 5),
            codEmpresaDestinoElim: validarCampo(campos, 6)
        };
    }
    
    /**
     * Valida a estrutura do registro baseada no layout oficial
     */
    function validarLayoutRegistro(registro, campos, tipoSped) {
        const layoutsMinimos = {
            'fiscal': {
                '0000': 15,
                'C100': 18,
                'C170': 19,
                'E110': 29
            },
            'contribuicoes': {
                'M105': 7,
                'M200': 14,
                'M600': 14
            },
            'ecd': {
                'I200': 15,
                'I250': 8
            }
        };

        const minCampos = layoutsMinimos[tipoSped]?.[registro];
        if (minCampos && campos.length < minCampos) {
            console.warn(`Registro ${registro} (${tipoSped}): esperados ${minCampos} campos, encontrados ${campos.length}`);
            return false;
        }
        return true;
    }      
        
    // Interface pública
    return {
        processarArquivo,
        tiposSuportados: Object.keys(registrosMapeados),
        versao: '2.0.0-corrigida'
    };
})();

// Garantir que o SpedParser seja carregado globalmente
if (typeof window !== 'undefined') {
    window.SpedParser = SpedParser;
    console.log('SPED-PARSER: Módulo carregado com sucesso na versão', SpedParser.versao);
}