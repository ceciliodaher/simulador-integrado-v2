/**
 * Configurações do parser
 */
const CONFIG = {
    // Tamanhos máximos para segurança
    tamanhoMaximoArquivo: 100 * 1024 * 1024, // 100MB
    numeroMaximoLinhas: 1000000, // 1 milhão de linhas
    timeoutLeitura: 60000, // 60 segundos
    
    // Configurações de parsing
    separadorCampo: '|',
    terminadorLinha: /\r?\n/,
    codificacaoArquivo: 'UTF-8',
    
    // Tipos de SPED suportados
    tiposSuportados: {
        'EFD-ICMS/IPI': {
            codigo: 'fiscal',
            descricao: 'SPED Fiscal - EFD ICMS/IPI',
            versoes: ['014', '015', '016', '017'],
            registroIdentificador: '0000',
            codigoLayoutEsperado: '014'
        },
        'EFD-Contribuições': {
            codigo: 'contribuicoes',
            descricao: 'SPED Contribuições - EFD PIS/COFINS',
            versoes: ['011', '012', '013'],
            registroIdentificador: '0000',
            codigoLayoutEsperado: '011'
        },
        'ECF': {
            codigo: 'ecf',
            descricao: 'Escrituração Contábil Fiscal',
            versoes: ['010', '011', '012'],
            registroIdentificador: 'J001',
            codigoLayoutEsperado: '010'
        },
        'ECD': {
            codigo: 'ecd',
            descricao: 'Escrituração Contábil Digital',
            versoes: ['010', '011', '012'],
            registroIdentificador: 'I001',
            codigoLayoutEsperado: '010'
        }
    },
    
    // Registros principais de cada tipo de SPED
    registrosPrincipais: {
        fiscal: {
            // Identificação e abertura
            abertura: ['0000', '0001', '0005', '0015', '0100', '0150', '0190', '0200', '0205', '0210'],
            // Documentos fiscais de entrada
            entradas: ['C100', 'C101', 'C105', 'C110', 'C111', 'C112', 'C113', 'C114', 'C120', 'C130'],
            // Documentos fiscais de saída
            saidas: ['C300', 'C301', 'C305', 'C310', 'C311', 'C312', 'C313', 'C314', 'C320', 'C321'],
            // Apuração ICMS
            apuracaoICMS: ['E001', 'E100', 'E110', 'E111', 'E112', 'E113', 'E115', 'E116'],
            // Apuração IPI
            apuracaoIPI: ['E200', 'E210', 'E220', 'E230', 'E240', 'E250'],
            // Inventário
            inventario: ['H001', 'H005', 'H010', 'H020'],
            // Encerramento
            encerramento: ['9001', '9900', '9990', '9999']
        },
        contribuicoes: {
            // Identificação
            abertura: ['0000', '0001', '0035', '0100', '0110', '0111', '0120', '0140', '0150'],
            // Receitas
            receitas: ['A100', 'A110', 'A111', 'A120', 'A170'],
            // Custos
            custos: ['A200', 'A210', 'A220', 'A230'],
            // Créditos
            creditos: ['C100', 'C110', 'C111', 'C120', 'C170', 'C175', 'C180', 'C181', 'C185'],
            // Apuração PIS
            apuracaoPIS: ['M100', 'M105', 'M110', 'M115', 'M200', 'M205', 'M210', 'M220', 'M225'],
            // Apuração COFINS
            apuracaoCOFINS: ['M400', 'M405', 'M410', 'M411', 'M500', 'M505', 'M510', 'M515'],
            // Encerramento
            encerramento: ['9001', '9900', '9990', '9999']
        },
        ecf: {
            // Identificação
            abertura: ['J001', 'J005'],
            // Demonstrações
            demonstracoes: ['J100', 'J150', 'J200', 'J210', 'J215', 'J800', 'J801', 'J900', 'J930', 'J932'],
            // Encerramento
            encerramento: ['9001', '9900', '9990', '9999']
        },
        ecd: {
            // Identificação
            abertura: ['I001', 'I010', 'I012', 'I015', 'I020', 'I030', 'I050', 'I051', 'I052'],
            // Plano de contas
            planoContas: ['I100', 'I150', 'I155', 'I200', 'I250', 'I300', 'I310', 'I350', 'I355'],
            // Balancetes e balanços
            balancetes: ['J100', 'J150', 'J200', 'J210', 'J215'],
            // Demonstrações
            demonstracoes: ['J800', 'J801', 'J900', 'J930', 'J932', 'J935'],
            // Encerramento
            encerramento: ['9001', '9900', '9990', '9999']
        }
    },
    
    // Tolerâncias e limites
    tolerancias: {
        percentualLeituraMinimo: 0.95, // 95% das linhas devem ser processadas com sucesso
        percentualRegistrosMinimo: 0.90, // 90% dos registros devem ser válidos
        tamanhoMinimoArquivo: 1024 // 1KB mínimo
    }
};

/**
 * Classe principal do parser SPED
 */
class SpedParser {
    constructor() {
        this.estatisticas = {
            linhasProcessadas: 0,
            linhasComErro: 0,
            registrosEncontrados: 0,
            registrosValidos: 0,
            tempoProcessamento: 0,
            erros: []
        };
        
        this.dadosExtraidos = {};
        this.tipoSpedIdentificado = null;
        this.versaoLayout = null;
        this.log = [];
    }

    /**
     * Adiciona entrada ao log interno
     * @param {string} mensagem - Mensagem do log
     * @param {string} nivel - Nível do log (info, warning, error)
     * @param {Object} detalhes - Detalhes adicionais
     */
    adicionarLog(mensagem, nivel = 'info', detalhes = null) {
        const entrada = {
            timestamp: new Date().toISOString(),
            nivel: nivel,
            mensagem: mensagem,
            detalhes: detalhes
        };
        
        this.log.push(entrada);
        
        // Log no console também para desenvolvimento
        const metodo = nivel === 'error' ? 'error' : nivel === 'warning' ? 'warn' : 'log';
        console[metodo](`[SPED-PARSER] ${mensagem}`, detalhes || '');
    }

    /**
     * Valida o arquivo antes do processamento
     * @param {File} arquivo - Arquivo a ser validado
     * @returns {Object} Resultado da validação
     */
    validarArquivo(arquivo) {
        const validacao = {
            valido: true,
            erros: [],
            avisos: []
        };

        try {
            // Validar tamanho
            if (arquivo.size === 0) {
                validacao.valido = false;
                validacao.erros.push('Arquivo vazio');
            } else if (arquivo.size < CONFIG.tolerancias.tamanhoMinimoArquivo) {
                validacao.avisos.push(`Arquivo muito pequeno (${arquivo.size} bytes)`);
            } else if (arquivo.size > CONFIG.tamanhoMaximoArquivo) {
                validacao.valido = false;
                validacao.erros.push(`Arquivo muito grande: ${this.formatarTamanho(arquivo.size)}. Máximo: ${this.formatarTamanho(CONFIG.tamanhoMaximoArquivo)}`);
            }

            // Validar tipo
            const extensao = arquivo.name.toLowerCase().split('.').pop();
            if (!['txt', 'sped'].includes(extensao)) {
                validacao.avisos.push(`Extensão incomum para SPED: .${extensao}`);
            }

            // Validar nome (heurística)
            const nomeArquivo = arquivo.name.toLowerCase();
            const palavrasChave = ['sped', 'efd', 'ecf', 'ecd', 'fiscal', 'contribuicoes'];
            const contemPalavraChave = palavrasChave.some(palavra => nomeArquivo.includes(palavra));
            
            if (!contemPalavraChave) {
                validacao.avisos.push('Nome do arquivo não contém palavras-chave típicas de SPED');
            }

            this.adicionarLog(`Validação de arquivo concluída: ${validacao.valido ? 'Válido' : 'Inválido'}`, 
                              validacao.valido ? 'info' : 'error', {
                arquivo: arquivo.name,
                tamanho: arquivo.size,
                erros: validacao.erros,
                avisos: validacao.avisos
            });

        } catch (erro) {
            validacao.valido = false;
            validacao.erros.push(`Erro na validação: ${erro.message}`);
            this.adicionarLog('Erro durante validação do arquivo', 'error', erro);
        }

        return validacao;
    }

    /**
     * Lê o conteúdo do arquivo
     * @param {File} arquivo - Arquivo a ser lido
     * @returns {Promise<string>} Conteúdo do arquivo
     */
    async lerArquivo(arquivo) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const timeoutId = setTimeout(() => {
                reject(new Error('Timeout na leitura do arquivo'));
            }, CONFIG.timeoutLeitura);

            reader.onload = (evento) => {
                clearTimeout(timeoutId);
                resolve(evento.target.result);
            };

            reader.onerror = (erro) => {
                clearTimeout(timeoutId);
                reject(new Error(`Erro ao ler arquivo: ${erro.message}`));
            };

            try {
                reader.readAsText(arquivo, CONFIG.codificacaoArquivo);
            } catch (erro) {
                clearTimeout(timeoutId);
                reject(erro);
            }
        });
    }

    /**
     * Identifica o tipo de SPED baseado no conteúdo
     * @param {string} conteudo - Conteúdo do arquivo
     * @returns {Object|null} Informações do tipo identificado
     */
    identificarTipoSped(conteudo) {
        this.adicionarLog('Iniciando identificação do tipo de SPED...');

        try {
            const linhas = conteudo.split(CONFIG.terminadorLinha);
            
            // Procurar pela primeira linha não vazia
            let primeiraLinha = null;
            for (let i = 0; i < Math.min(linhas.length, 10); i++) {
                const linha = linhas[i].trim();
                if (linha.length > 0) {
                    primeiraLinha = linha;
                    break;
                }
            }

            if (!primeiraLinha) {
                this.adicionarLog('Nenhuma linha válida encontrada no arquivo', 'error');
                return null;
            }

            this.adicionarLog(`Primeira linha encontrada: ${primeiraLinha.substring(0, 100)}...`);

            // Analisar estrutura da primeira linha
            const campos = primeiraLinha.split(CONFIG.separadorCampo);
            if (campos.length < 3) {
                this.adicionarLog('Estrutura de linha inválida para SPED', 'error');
                return null;
            }

            // Identificar tipo baseado no primeiro registro
            const codigoRegistro = campos[1]; // Campo REG
            const tipoIdentificado = this.identificarPorCodigoRegistro(codigoRegistro, campos);

            if (tipoIdentificado) {
                this.tipoSpedIdentificado = tipoIdentificado;
                this.versaoLayout = this.extrairVersaoLayout(campos);
                
                this.adicionarLog(`Tipo SPED identificado: ${tipoIdentificado.descricao}`, 'info', {
                    codigo: tipoIdentificado.codigo,
                    versao: this.versaoLayout,
                    registro: codigoRegistro
                });

                return {
                    tipo: tipoIdentificado,
                    versao: this.versaoLayout,
                    registroIdentificador: codigoRegistro
                };
            } else {
                this.adicionarLog(`Tipo de SPED não reconhecido. Registro: ${codigoRegistro}`, 'error');
                return null;
            }

        } catch (erro) {
            this.adicionarLog('Erro na identificação do tipo de SPED', 'error', erro);
            return null;
        }
    }

    /**
     * Identifica o tipo de SPED pelo código do registro
     * @param {string} codigoRegistro - Código do registro
     * @param {Array} campos - Campos da linha
     * @returns {Object|null} Tipo identificado
     */
    identificarPorCodigoRegistro(codigoRegistro, campos) {
        // SPED Fiscal - EFD ICMS/IPI
        if (codigoRegistro === '0000' && campos.length >= 6) {
            const codigoFinalidade = campos[2]; // Campo COD_FIN
            if (['0', '1'].includes(codigoFinalidade)) {
                return CONFIG.tiposSuportados['EFD-ICMS/IPI'];
            }
        }
        
        // ECF - Escrituração Contábil Fiscal
        if (codigoRegistro === 'J001') {
            return CONFIG.tiposSuportados['ECF'];
        }
        
        // ECD - Escrituração Contábil Digital
        if (codigoRegistro === 'I001') {
            return CONFIG.tiposSuportados['ECD'];
        }
        
        // Análise mais detalhada para diferenciar SPED Fiscal de Contribuições
        if (codigoRegistro === '0000') {
            // Examinar mais linhas para distinguir
            return this.analisarConteudoParaIdentificacao(campos);
        }

        return null;
    }

    /**
     * Análise mais profunda para identificação em casos ambíguos
     * @param {Array} campos - Campos da primeira linha
     * @returns {Object|null} Tipo identificado
     */
    analisarConteudoParaIdentificacao(campos) {
        // Se tem mais de 10 campos, provavelmente é SPED Fiscal
        if (campos.length > 10) {
            return CONFIG.tiposSuportados['EFD-ICMS/IPI'];
        }
        
        // Verificar padrões específicos nos campos
        const terceiroCampo = campos[2] || '';
        
        // SPED Contribuições geralmente tem códigos específicos
        if (['2', '3', '4'].includes(terceiroCampo)) {
            return CONFIG.tiposSuportados['EFD-Contribuições'];
        }
        
        // Por padrão, assumir SPED Fiscal
        return CONFIG.tiposSuportados['EFD-ICMS/IPI'];
    }

    /**
     * Extrai a versão do layout do arquivo
     * @param {Array} campos - Campos da linha de identificação
     * @returns {string} Versão do layout
     */
    extrairVersaoLayout(campos) {
        // A versão geralmente está no campo 3 ou 4
        if (campos.length >= 4) {
            const possivelVersao = campos[3];
            if (/^\d{3}$/.test(possivelVersao)) {
                return possivelVersao;
            }
        }
        
        if (campos.length >= 5) {
            const possivelVersao = campos[4];
            if (/^\d{3}$/.test(possivelVersao)) {
                return possivelVersao;
            }
        }
        
        return 'desconhecida';
    }

    /**
     * Formata tamanho de arquivo
     * @param {number} bytes - Tamanho em bytes
     * @returns {string} Tamanho formatado
     */
    formatarTamanho(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

/**
 * Função principal de parsing (interface pública)
 * @param {File} arquivo - Arquivo SPED a ser parseado
 * @param {Object} opcoes - Opções de processamento
 * @returns {Promise<Object>} Resultado do parsing
 */
async function parsearArquivoSped(arquivo, opcoes = {}) {
    console.log('SPED-PARSER: Iniciando parsing do arquivo SPED...', arquivo.name);

    const parser = new SpedParser();

    try {
        // 1. Validar arquivo
        const validacao = parser.validarArquivo(arquivo);
        if (!validacao.valido) {
            return {
                sucesso: false,
                erro: `Arquivo inválido: ${validacao.erros.join(', ')}`,
                avisos: validacao.avisos,
                estatisticas: parser.estatisticas,
                log: parser.log
            };
        }

        // 2. Ler conteúdo do arquivo
        parser.adicionarLog(`Lendo arquivo: ${arquivo.name} (${parser.formatarTamanho(arquivo.size)})`);
        const conteudo = await parser.lerArquivo(arquivo);
        
        // 3. Identificar tipo de SPED
        const tipoIdentificado = parser.identificarTipoSped(conteudo);
        if (!tipoIdentificado) {
            return {
                sucesso: false,
                erro: 'Não foi possível identificar o tipo de SPED',
                estatisticas: parser.estatisticas,
                log: parser.log
            };
        }

        // 4. Processar o conteúdo e extrair registros
        parser.adicionarLog('Iniciando extração de registros do SPED...');
        const startTime = performance.now();

        const linhas = conteudo.split(CONFIG.terminadorLinha);
        const registrosExtraidos = {};
        let dadosEmpresa = {
            razaoSocial: null,
            cnpj: null,
            dataInicialPeriodo: null, // Será preenchido pelo extractor específico
            dataFinalPeriodo: null   // Será preenchido pelo extractor específico
        };
        const resumo = {
            totalTiposRegistro: 0,
            registrosPorTipo: {}
        };

        for (const linha of linhas) {
            parser.estatisticas.linhasProcessadas++;
            const linhaTrimmed = linha.trim();

            if (linhaTrimmed === '') {
                continue;
            }

            if (!linhaTrimmed.startsWith(CONFIG.separadorCampo) || !linhaTrimmed.endsWith(CONFIG.separadorCampo)) {
                parser.estatisticas.linhasComErro++;
                parser.adicionarLog(`Linha ignorada (formato inválido): ${linhaTrimmed.substring(0, 50)}...`, 'warning');
                continue;
            }

            parser.estatisticas.registrosEncontrados++;
            const campos = linhaTrimmed.split(CONFIG.separadorCampo);

            // campos[0] é vazio devido ao "|" inicial, campos[1] é o tipo do registro
            // campos[campos.length - 1] é vazio devido ao "|" final
            if (campos.length < 2) { // Deve ter pelo menos |REG|
                parser.estatisticas.linhasComErro++;
                parser.adicionarLog(`Linha ignorada (sem campos suficientes): ${linhaTrimmed.substring(0,50)}...`, 'warning');
                continue;
            }
            
            const tipoRegistro = campos[1];
            const camposValores = campos.slice(2, campos.length -1); // Ignora o primeiro vazio, o tipo, e o último vazio

            if (!registrosExtraidos[tipoRegistro]) {
                registrosExtraidos[tipoRegistro] = [];
            }
            registrosExtraidos[tipoRegistro].push(camposValores);
            parser.estatisticas.registrosValidos++;

            // Tentar extrair dados da empresa do registro 0000 (primeira ocorrência)
            if (tipoRegistro === '0000' && !dadosEmpresa.cnpj && camposValores.length >= 6) {
                dadosEmpresa.razaoSocial = camposValores[4]; // NOME
                dadosEmpresa.cnpj = camposValores[5];       // CNPJ
                dadosEmpresa.dataInicialPeriodo = camposValores[2]; // DT_INI
                dadosEmpresa.dataFinalPeriodo = camposValores[3];   // DT_FIN
                parser.adicionarLog(`Dados da empresa extraídos do registro 0000: ${dadosEmpresa.razaoSocial}`, 'info');
            }
        }

        // Calcular resumo
        for (const tipo in registrosExtraidos) {
            if (registrosExtraidos.hasOwnProperty(tipo)) {
                resumo.registrosPorTipo[tipo] = registrosExtraidos[tipo].length;
                resumo.totalTiposRegistro++;
            }
        }
        
        parser.estatisticas.tempoProcessamento = performance.now() - startTime;
        parser.adicionarLog(`Extração de registros concluída em ${parser.estatisticas.tempoProcessamento.toFixed(2)}ms`, 'info', {
            registros: resumo.totalTiposRegistro,
            linhas: parser.estatisticas.linhasProcessadas
        });

        // 5. Retornar resultado do parsing
        return {
            sucesso: true,
            tipoSped: tipoIdentificado,
            dadosEmpresa: dadosEmpresa,
            registros: registrosExtraidos,
            resumo: resumo,
            estatisticas: parser.estatisticas,
            log: parser.log,
            metadados: {
                nomeArquivo: arquivo.name,
                tamanhoArquivo: arquivo.size,
                timestampProcessamento: new Date().toISOString(),
                versaoParser: '1.0.0'
            }
        };

    } catch (erro) {
        console.error('SPED-PARSER: Erro durante o parsing:', erro);
        parser.adicionarLog('Erro crítico durante o parsing', 'error', erro);
        
        return {
            sucesso: false,
            erro: `Erro no processamento: ${erro.message}`,
            estatisticas: parser.estatisticas,
            log: parser.log
        };
    }
}

/**
 * Função utilitária para identificar tipo de SPED sem processar
 * @param {File} arquivo - Arquivo SPED
 * @returns {Promise<Object|null>} Tipo identificado ou null
 */
async function identificarTipoArquivoSped(arquivo) {
    const parser = new SpedParser();
    
    try {
        // Ler apenas o início do arquivo
        const conteudo = await parser.lerArquivo(arquivo);
        const linhasIniciais = conteudo.split(CONFIG.terminadorLinha).slice(0, 10).join('\n');
        
        return parser.identificarTipoSped(linhasIniciais);
    } catch (erro) {
        console.error('SPED-PARSER: Erro na identificação:', erro);
        return null;
    }
}

/**
 * Função utilitária para validar arquivo SPED
 * @param {File} arquivo - Arquivo a ser validado
 * @returns {Object} Resultado da validação
 */
function validarArquivoSped(arquivo) {
    const parser = new SpedParser();
    return parser.validarArquivo(arquivo);
}

// Criar módulo global usando IIFE (Immediately Invoked Function Expression)
window.SpedParser = (function() {
    // Interface pública do módulo
    return {
        parsearArquivoSped,
        identificarTipoArquivoSped,
        validarArquivoSped,
        CONFIG,
        
        // Classes e utilitários expostos para extensão
        SpedParser
    };
})();