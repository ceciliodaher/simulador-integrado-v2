// --- Test Helper Functions ---
function _formatValue(value) {
    if (Array.isArray(value)) {
        return `[${value.map(_formatValue).join(', ')}]`;
    }
    if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
    }
    return String(value);
}

function assertEquals(expected, actual, message) {
    if (expected !== actual) {
        console.error(`❌ Assertion Failed: ${message}. Expected: ${_formatValue(expected)}, Actual: ${_formatValue(actual)}`);
        return false;
    }
    console.log(`✅ Assertion Passed: ${message}.`);
    return true;
}

function assertFloatEquals(expected, actual, tolerance = 0.001, message) {
    if (Math.abs(expected - actual) > tolerance) {
        console.error(`❌ Assertion Failed (Float): ${message}. Expected: ${expected}, Actual: ${actual} (tolerance: ${tolerance})`);
        return false;
    }
    console.log(`✅ Assertion Passed (Float): ${message}.`);
    return true;
}

function assertArrayEquals(expected, actual, message) {
    if (!Array.isArray(expected) || !Array.isArray(actual) || expected.length !== actual.length) {
        console.error(`❌ Assertion Failed (Array Length): ${message}. Expected length: ${expected?.length}, Actual length: ${actual?.length}`);
        return false;
    }
    for (let i = 0; i < expected.length; i++) {
        if (Array.isArray(expected[i]) && Array.isArray(actual[i])) {
            if (!assertArrayEquals(expected[i], actual[i], `${message} (element ${i})`)) return false;
        } else if (expected[i] !== actual[i]) {
            console.error(`❌ Assertion Failed (Array Element): ${message}. Index ${i}. Expected: ${_formatValue(expected[i])}, Actual: ${_formatValue(actual[i])}`);
            return false;
        }
    }
    console.log(`✅ Assertion Passed (Array): ${message}.`);
    return true;
}

function assertObjectContainsKey(obj, key, message) {
    if (!(key in obj)) {
        console.error(`❌ Assertion Failed (Object Key): ${message}. Expected object to contain key: '${key}'. Object: ${JSON.stringify(obj)}`);
        return false;
    }
    console.log(`✅ Assertion Passed (Object Key): ${message}.`);
    return true;
}

function assertTrue(condition, message) {
    if (!condition) {
        console.error(`❌ Assertion Failed (True): ${message}. Condition was false.`);
        return false;
    }
    console.log(`✅ Assertion Passed (True): ${message}.`);
    return true;
}

// Mock File object for SpedParser
function createMockFile(content, fileName = 'test.txt') {
    return new File([new Blob([content], { type: 'text/plain' })], fileName, {
        lastModified: new Date().getTime(),
        type: 'text/plain'
    });
}

// --- SpedParser Tests ---
async function testSpedParser() {
    console.log("\n--- Running SpedParser Tests ---");

    // Test 1: Basic '0000' record parsing
    const test1Content = "|0000|LAYOUT014|0|01012023|31012023|NOME EMPRESA TESTE|12345678000199|MG|12345|IE ISENTO|IM ISENTO|0|1|\n";
    const test1File = createMockFile(test1Content);
    let result1 = await SpedParser.parsearArquivoSped(test1File);

    assertTrue(result1.sucesso, "Test 1: Parsing success");
    assertObjectContainsKey(result1.registros, '0000', "Test 1: '0000' record exists");
    if (result1.registros && result1.registros['0000']) {
        assertEquals(1, result1.registros['0000'].length, "Test 1: One '0000' record found");
        assertArrayEquals(
            ['LAYOUT014', '0', '01012023', '31012023', 'NOME EMPRESA TESTE', '12345678000199', 'MG', '12345', 'IE ISENTO', 'IM ISENTO', '0', '1'],
            result1.registros['0000'][0],
            "Test 1: '0000' record fields"
        );
    }
    assertEquals("NOME EMPRESA TESTE", result1.dadosEmpresa.razaoSocial, "Test 1: dadosEmpresa.razaoSocial");
    assertEquals("12345678000199", result1.dadosEmpresa.cnpj, "Test 1: dadosEmpresa.cnpj");
    assertEquals("01012023", result1.dadosEmpresa.dataInicialPeriodo, "Test 1: dadosEmpresa.dataInicialPeriodo");
    assertEquals("31012023", result1.dadosEmpresa.dataFinalPeriodo, "Test 1: dadosEmpresa.dataFinalPeriodo");


    // Test 2: Multiple record types and multiple records of the same type
    const test2Content = 
        "|0000|LAYOUT015|0|01022023|28022023|EMPRESA MULTIREG|98765432000100|SP||||0|0|\n" +
        "|0200|ITEM001|DESC1|123||UN||||||\n" +
        "|0200|ITEM002|DESC2|456||UN||||||\n" +
        "|C100|1|0|NF001|600.00|1|0||100.00|50.00|\n";
    const test2File = createMockFile(test2Content);
    let result2 = await SpedParser.parsearArquivoSped(test2File);

    assertTrue(result2.sucesso, "Test 2: Parsing success");
    assertObjectContainsKey(result2.registros, '0000', "Test 2: '0000' record exists");
    assertObjectContainsKey(result2.registros, '0200', "Test 2: '0200' record exists");
    assertObjectContainsKey(result2.registros, 'C100', "Test 2: 'C100' record exists");
    if (result2.registros && result2.registros['0200']) {
        assertEquals(2, result2.registros['0200'].length, "Test 2: Two '0200' records found");
    }
    if (result2.resumo && result2.resumo.registrosPorTipo) {
        assertEquals(1, result2.resumo.registrosPorTipo['0000'], "Test 2: Resumo count '0000'");
        assertEquals(2, result2.resumo.registrosPorTipo['0200'], "Test 2: Resumo count '0200'");
        assertEquals(1, result2.resumo.registrosPorTipo['C100'], "Test 2: Resumo count 'C100'");
        assertEquals(3, result2.resumo.totalTiposRegistro, "Test 2: Resumo totalTiposRegistro");
    }

    // Test 3: Line skipping
    const test3Content = 
        "|0000|LAYOUT016|1|01032023|31032023|EMPRESA LINHAS|11223344000155|RJ||||1|1|\n" +
        "\n" + // Empty line
        "INVALID LINE\n" + // Invalid line
        "|C100|0|1|NF002|250.00|0|0||0|0|\n" +
        "|E110|10.00|5.00|5.00|0|0|0|0|0|0|0|0|0|0|0|0|0|0||\n"; // Valid E110
    const test3File = createMockFile(test3Content);
    let result3 = await SpedParser.parsearArquivoSped(test3File);
    
    assertTrue(result3.sucesso, "Test 3: Parsing success");
    assertEquals(5, result3.estatisticas.linhasProcessadas, "Test 3: linhasProcessadas"); // 4 valid content lines + 1 empty (processed but skipped)
    assertEquals(1, result3.estatisticas.linhasComErro, "Test 3: linhasComErro");
    assertEquals(3, result3.estatisticas.registrosValidos, "Test 3: registrosValidos");
    assertObjectContainsKey(result3.registros, '0000', "Test 3: '0000' exists");
    assertObjectContainsKey(result3.registros, 'C100', "Test 3: 'C100' exists");
    assertObjectContainsKey(result3.registros, 'E110', "Test 3: 'E110' exists");


    // Test 4: Field extraction
    const test4Content = "|C170|1|ITEM001|Descricao Detalhada do Item|10|UN|50.00|0|010|12345|5.00|0|5.00|0.00|0.00|0|0|0|0||\n";
    const test4File = createMockFile(test4Content);
    let result4 = await SpedParser.parsearArquivoSped(test4File);

    assertTrue(result4.sucesso, "Test 4: Parsing success");
    assertObjectContainsKey(result4.registros, 'C170', "Test 4: 'C170' record exists");
    if (result4.registros && result4.registros['C170']) {
        assertEquals(1, result4.registros['C170'].length, "Test 4: One 'C170' record found");
        assertArrayEquals(
            ['1', 'ITEM001', 'Descricao Detalhada do Item', '10', 'UN', '50.00', '0', '010', '12345', '5.00', '0', '5.00', '0.00', '0.00', '0', '0', '0', '0', ''],
            result4.registros['C170'][0],
            "Test 4: 'C170' record fields"
        );
    }
    console.log("--- SpedParser Tests Finished ---");
}

// --- SpedExtractor Tests ---
function testSpedExtractor() {
    console.log("\n--- Running SpedExtractor Tests ---");
    if (!window.SpedExtractor || !window.SpedExtractor.processarDadosConsolidados) {
        console.error("SpedExtractor or processarDadosConsolidados not found. Skipping tests.");
        return;
    }

    // Test 1: extrairDadosFinanceiros - ECF J150 Revenue and Cost
    const mockSpedDataTest1 = {
        'sped-ecf': {
            registros: {
                'J150': [ // DRE
                    // REG, DT_INI, DT_FIN, COD_AGL, DESC_CTA_AGL, VL_CTA_FIN, IND_VL_CTA_FIN ... (simplified for test)
                    ['J150', '01012023', '31012023', '3.01.01.01.01', 'RECEITA BRUTA DE VENDAS', '10000.00', 'C'],
                    ['J150', '01012023', '31012023', '3.01.01.02.01', 'DEDUÇÕES - IMPOSTOS SOBRE VENDAS', '1000.00', 'D'],
                    ['J150', '01012023', '31012023', '3.02.01.01.01', 'CUSTO DOS PRODUTOS VENDIDOS', '6000.00', 'D'],
                ]
            },
            dadosEmpresa: { razaoSocial: "ECF Test Corp" } // Needed for SpedExtractor
        }
    };
    let resultExtractor1 = SpedExtractor.processarDadosConsolidados(mockSpedDataTest1, { calcularTransicao: false });
    
    assertTrue(resultExtractor1.dadosFinanceiros !== null, "Extractor Test 1: dadosFinanceiros exists");
    assertFloatEquals(10000.00, resultExtractor1.dadosFinanceiros.receitas.receitaBruta, 0.01, "Extractor Test 1: Receita Bruta");
    assertFloatEquals(9000.00, resultExtractor1.dadosFinanceiros.receitas.receitaLiquida, 0.01, "Extractor Test 1: Receita Liquida (10000 - 1000)");
    assertFloatEquals(6000.00, resultExtractor1.dadosFinanceiros.custos.custoTotal, 0.01, "Extractor Test 1: Custo Total");


    // Test 2: processarComposicaoTributaria - SPED Fiscal ICMS Credits and Debits
    const mockSpedDataTest2 = {
        'sped-fiscal': {
            registros: {
                'E110': [ // REG, VL_TOT_DEBITOS, VL_TOT_CREDITOS, ...
                    ['E110', '1000.00', '200.00', '800.00', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '']
                ]
            },
            dadosEmpresa: { razaoSocial: "Fiscal Test Corp" }
        }
    };
    let resultExtractor2 = SpedExtractor.processarDadosConsolidados(mockSpedDataTest2, { calcularTransicao: false });

    assertTrue(resultExtractor2.composicaoTributaria !== null, "Extractor Test 2: composicaoTributaria exists");
    assertFloatEquals(200.00, resultExtractor2.composicaoTributaria.creditos.icms, 0.01, "Extractor Test 2: ICMS Credits");
    assertFloatEquals(1000.00, resultExtractor2.composicaoTributaria.debitos.icms, 0.01, "Extractor Test 2: ICMS Debits");


    // Test 3: processarComposicaoTributaria - SPED Contribuições PIS/COFINS Credits
    // Using placeholder indices 27 (PIS) and 33 (COFINS) for C100 as per previous discussions
    // C100 structure: |C100|IND_OPER|IND_EMIT|COD_PART|COD_MOD|... (many fields) ...|VL_PIS (field 28)|...|VL_COFINS (field 34)|
    // We need an array of 34 elements for the test, with values at index 27 and 33.
    let c100RecordPisCofins = new Array(34).fill('');
    c100RecordPisCofins[0] = 'C100'; // REG
    c100RecordPisCofins[27] = '50.00'; // VL_PIS (placeholder for credit)
    c100RecordPisCofins[33] = '200.00'; // VL_COFINS (placeholder for credit)
    
    const mockSpedDataTest3 = {
        'sped-contribuicoes': {
            registros: {
                'C100': [ c100RecordPisCofins ]
            },
            dadosEmpresa: { razaoSocial: "Contrib Test Corp" }
        }
    };
    let resultExtractor3 = SpedExtractor.processarDadosConsolidados(mockSpedDataTest3, { calcularTransicao: false });
    
    assertTrue(resultExtractor3.composicaoTributaria !== null, "Extractor Test 3: composicaoTributaria exists");
    // Note: The current SpedExtractor logic for C100 in SPED Contribuições might not directly sum these as credits.
    // The test assumes that if these fields are populated, they contribute to credit calculation.
    // This part of SpedExtractor might need adjustment if direct credit summation from C100 is expected.
    // For now, we test if the values are picked up as PIS/COFINS values, which might then be used in credit logic.
    // The current Extractor logic maps these C100 fields as credits directly.
    assertFloatEquals(50.00, resultExtractor3.composicaoTributaria.creditos.pis, 0.01, "Extractor Test 3: PIS Credits from C100");
    assertFloatEquals(200.00, resultExtractor3.composicaoTributaria.creditos.cofins, 0.01, "Extractor Test 3: COFINS Credits from C100");

    console.log("--- SpedExtractor Tests Finished ---");
}


// --- Run All Tests ---
async function runAllTests() {
    console.log("===== Starting All Unit Tests =====");
    await testSpedParser();
    // Ensure SpedExtractor and its dependencies are loaded before running its tests
    if (typeof SpedParser !== 'undefined' && typeof SpedExtractor !== 'undefined' && typeof DataManager !== 'undefined') {
        // Mock DataManager if its full version isn't available or needed for these specific tests
        if (!window.DataManager) {
            window.DataManager = {
                obterEstruturaAninhadaPadrao: () => ({ empresa: {}, parametrosFiscais: { creditos: {}, debitos: {} }, cicloFinanceiro: {}, metadados: {} }),
                validarENormalizar: (dados) => dados, // Simple pass-through for testing
                preencherFormulario: () => { console.log("Mock DataManager.preencherFormulario called"); }
            };
        }
         // Mock CONFIG for SpedExtractor if it's not globally available from sped-extractor.js
        if (window.SpedExtractor && !window.SpedExtractor.CONFIG && window.CONFIG_EXTRACTOR_TEST) { // Assume CONFIG_EXTRACTOR_TEST is a global mock
            window.SpedExtractor.CONFIG = window.CONFIG_EXTRACTOR_TEST;
        } else if (window.SpedExtractor && !window.SpedExtractor.CONFIG) {
             // Define a minimal mock CONFIG if not present, to avoid errors if SpedExtractor relies on it.
            window.SpedExtractor.CONFIG = {
                tolerancias: { percentualVariacao: 0.05, valorMinimo: 0.01, margemErro: 0.001 },
                aliquotasIVA: { cbs: 8.8, ibs: 17.7, total: 26.5 },
                cronogramaTransicao: { 2026: { sistemaAtual: 0.90, ivaDual: 0.10 } } // minimal
            };
            console.warn("SpedExtractor.CONFIG was not found. Using a minimal mock for tests.");
        }

        testSpedExtractor();
    } else {
        console.warn("SpedExtractor or its dependencies (SpedParser, DataManager) not fully loaded. Skipping SpedExtractor tests.");
    }
    console.log("===== All Unit Tests Finished =====");
}

// To run the tests, open your browser's developer console and call:
// runAllTests();
// Make sure sped-parser.js and sped-extractor.js are loaded first.
// You might also need to mock DataManager if it's not present or if its full functionality isn't needed.
// Example mock for DataManager if not present:
/*
if (typeof DataManager === 'undefined') {
    console.warn("DataManager not found, using mock for SpedExtractor tests.");
    window.DataManager = {
        obterEstruturaAninhadaPadrao: () => ({ empresa: {}, parametrosFiscais: { creditos: {}, debitos: {} }, cicloFinanceiro: {}, metadados: {} }),
        validarENormalizar: (dados) => dados,
        preencherFormulario: () => {}
    };
}
*/

// Minimal CONFIG mock for SpedExtractor if its CONFIG is not exposed or available globally
// This might be needed if SpedExtractor.js doesn't make its CONFIG globally accessible in a way the test can see.
/*
const CONFIG_EXTRACTOR_TEST = {
    tolerancias: { percentualVariacao: 0.05, valorMinimo: 0.01, margemErro: 0.001 },
    aliquotasIVA: { cbs: 8.8, ibs: 17.7, total: 26.5 },
    cronogramaTransicao: { 2026: { sistemaAtual: 0.90, ivaDual: 0.10 } } // minimal
};
if (window.SpedExtractor && !window.SpedExtractor.CONFIG) {
     window.SpedExtractor.CONFIG = CONFIG_EXTRACTOR_TEST;
}
*/
console.log("Unit test script loaded. Call runAllTests() to execute.");
