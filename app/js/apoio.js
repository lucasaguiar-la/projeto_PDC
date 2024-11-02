function formatarNumeroDecimal(input) {
    // Converte o input para string e remove caracteres não numéricos
    let numeroStr = input.toString().replace(/[^0-9]/g, '');

    // Verifica se há pelo menos 2 dígitos
    if (numeroStr.length < 2) {
        throw new Error('O número deve conter pelo menos dois dígitos.');
    }

    // Separa os dois últimos dígitos para a parte decimal
    let parteInteira = numeroStr.slice(0, -2);
    let parteDecimal = numeroStr.slice(-2);

    // Se não houver parte inteira, define como '0'
    if (parteInteira === '') {
        parteInteira = '0';
    }

    // Monta o número formatado em decimal
    let numeroFormatado = `${parteInteira}.${parteDecimal}`;

    return parseFloat(numeroFormatado).toFixed(2); // Retorna como número com 2 casas decimais
}

// Exemplos de uso
try {
    console.log(formatarNumeroDecimal("1.234,56")); // Saída: "12.34"
    console.log(formatarNumeroDecimal("123456"));    // Saída: "1234.56"
    console.log(formatarNumeroDecimal("00001234"));  // Saída: "12.34"
    console.log(formatarNumeroDecimal(123));         // Saída: "1.23"
    console.log(formatarNumeroDecimal("12"));        // Saída: "0.12"
} catch (error) {
    console.error(error.message);
}
