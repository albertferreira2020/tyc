import fs from 'fs';
import { execSync } from 'child_process';

class TyCCompiler {
    constructor(sourceCode) {
        this.sourceCode = sourceCode;
        this.tokens = [];
        this.ast = [];
        this.printCount = 0;
        this.variables = {}; // Para rastrear variáveis
    }

    tokenize() {
        // Melhor identificação de strings com template literals
        let inString = false;
        let stringStart = '';
        let currentString = '';
        let tokens = [];

        // Primeiro passo: identificar strings literais completas incluindo template strings
        for (let i = 0; i < this.sourceCode.length; i++) {
            const char = this.sourceCode[i];

            if (!inString && (char === '"' || char === "'" || char === '`')) {
                inString = true;
                stringStart = char;
                currentString = char;
            } else if (inString && char === stringStart && this.sourceCode[i - 1] !== '\\') {
                currentString += char;
                tokens.push(currentString);
                inString = false;
                currentString = '';
            } else if (inString) {
                currentString += char;
            } else if (/\s/.test(char)) {
                // Espaço em branco fora de strings
                continue;
            } else if (/[a-zA-Z_À-ÿ0-9]/.test(char)) {
                // Identificador ou número
                let word = char;
                while (i + 1 < this.sourceCode.length && /[a-zA-Z_À-ÿ0-9]/.test(this.sourceCode[i + 1])) {
                    word += this.sourceCode[++i];
                }
                tokens.push(word);
            } else if (char === '/' && this.sourceCode[i + 1] === '/') {
                // Comentário de linha
                while (i < this.sourceCode.length && this.sourceCode[i] !== '\n') {
                    i++;
                }
            } else if (char === '/' && this.sourceCode[i + 1] === '*') {
                // Comentário de bloco
                i += 2;
                while (i < this.sourceCode.length && !(this.sourceCode[i] === '*' && this.sourceCode[i + 1] === '/')) {
                    i++;
                }
                i += 1; // Pular o '/'
            } else {
                // Operador ou pontuação
                tokens.push(char);
            }
        }

        // Segundo passo: combinar operadores compostos
        this.tokens = [];
        for (let i = 0; i < tokens.length; i++) {
            if ((tokens[i] === '+' || tokens[i] === '-' || tokens[i] === '*' || tokens[i] === '/' ||
                tokens[i] === '=' || tokens[i] === '!' || tokens[i] === '<' || tokens[i] === '>') &&
                tokens[i + 1] === '=') {
                this.tokens.push(tokens[i] + '=');
                i++;
            } else if ((tokens[i] === '+' && tokens[i + 1] === '+') ||
                (tokens[i] === '-' && tokens[i + 1] === '-')) {
                this.tokens.push(tokens[i] + tokens[i + 1]);
                i++;
            } else if ((tokens[i] === '&' && tokens[i + 1] === '&') ||
                (tokens[i] === '|' && tokens[i + 1] === '|')) {
                this.tokens.push(tokens[i] + tokens[i + 1]);
                i++;
            } else {
                this.tokens.push(tokens[i]);
            }
        }
    }

    parse() {
        let index = 0;

        while (index < this.tokens.length) {
            const token = this.tokens[index];

            // Processar declarações de variáveis
            if (token === "const" || token === "let" || token === "var") {
                index = this.parseVariableDeclaration(index);
                continue;
            }

            // Processar loops for
            if (token === "for") {
                index = this.parseForLoop(index);
                continue;
            }

            // Processar console.log
            if (token === "console" && index + 2 < this.tokens.length &&
                this.tokens[index + 1] === "." && this.tokens[index + 2] === "log") {
                index = this.parseConsoleLog(index);
                continue;
            }

            index++;
        }
    }

    parseVariableDeclaration(index) {
        // Pular o token "const", "let" ou "var"
        index++;

        if (index < this.tokens.length) {
            const varName = this.tokens[index];
            this.variables[varName] = { type: "variable", initialized: false };

            // Pular o nome da variável
            index++;

            // Verificar atribuição
            if (index < this.tokens.length && this.tokens[index] === "=") {
                index++;

                // Verificar se é Date.now()
                if (index + 2 < this.tokens.length &&
                    this.tokens[index] === "Date" &&
                    this.tokens[index + 1] === "." &&
                    this.tokens[index + 2] === "now" &&
                    this.tokens[index + 3] === "(" &&
                    this.tokens[index + 4] === ")") {

                    this.variables[varName] = { type: "timestamp", initialized: true };
                    this.ast.push({
                        type: "VARIABLE_ASSIGN_DATE_NOW",
                        name: varName
                    });

                    index += 5; // Pular Date.now()
                }

                // Pular até o ponto e vírgula ou próximo token significativo
                while (index < this.tokens.length && this.tokens[index] !== ";") {
                    index++;
                }

                if (index < this.tokens.length && this.tokens[index] === ";") {
                    index++;
                }
            }
        }

        return index;
    }

    parseForLoop(index) {
        const forNode = { type: "FOR_LOOP", init: null, condition: null, update: null, body: [] };

        // Pular "for" e "("
        index += 2;

        // Processar inicialização (let i = 0)
        let initParts = [];
        while (index < this.tokens.length && this.tokens[index] !== ";") {
            initParts.push(this.tokens[index]);
            index++;
        }
        forNode.init = initParts.join(" ");

        // Extrair o nome da variável de iteração e valor inicial
        const initMatch = forNode.init.match(/let\s+(\w+)\s*=\s*(\d+)/);
        if (initMatch) {
            const [_, varName, initValue] = initMatch;
            forNode.iterVar = varName;
            forNode.initValue = parseInt(initValue);
            this.variables[varName] = { type: "counter", initialized: true, value: forNode.initValue };
        }

        // Pular o ";"
        index++;

        // Processar condição (i < 1000000)
        let condParts = [];
        while (index < this.tokens.length && this.tokens[index] !== ";") {
            condParts.push(this.tokens[index]);
            index++;
        }
        forNode.condition = condParts.join(" ");

        // Extrair o valor limite
        const condMatch = forNode.condition.match(/(\w+)\s*<\s*(\d+)/);
        if (condMatch) {
            const [_, varName, limitValue] = condMatch;
            forNode.limitValue = parseInt(limitValue);
        }

        // Pular o ";"
        index++;

        // Processar atualização (i++)
        let updateParts = [];
        while (index < this.tokens.length && this.tokens[index] !== ")") {
            updateParts.push(this.tokens[index]);
            index++;
        }
        forNode.update = updateParts.join(" ");

        // Pular o ")"
        index++;

        // Processar corpo do loop
        if (this.tokens[index] === "{") {
            index++; // Pular a chave de abertura

            let depth = 1;
            while (index < this.tokens.length && depth > 0) {
                if (this.tokens[index] === "{") {
                    depth++;
                } else if (this.tokens[index] === "}") {
                    depth--;
                    if (depth === 0) break;
                }

                // Processar console.log dentro do loop
                if (this.tokens[index] === "console" &&
                    index + 2 < this.tokens.length &&
                    this.tokens[index + 1] === "." &&
                    this.tokens[index + 2] === "log") {

                    // Verificar se é console.log(i)
                    if (index + 4 < this.tokens.length &&
                        this.tokens[index + 3] === "(" &&
                        this.tokens[index + 4] === forNode.iterVar &&
                        this.tokens[index + 5] === ")") {

                        forNode.body.push({
                            type: "PRINT_COUNTER",
                            varName: forNode.iterVar
                        });

                        index += 6; // Pular console.log(i)
                        continue;
                    }
                }

                index++;
            }
        }

        this.ast.push(forNode);
        return index + 1; // Retornar após a chave de fechamento
    }

    parseConsoleLog(index) {
        // Pular "console.log"
        index += 3;

        // Verificar se abre parêntese
        if (index < this.tokens.length && this.tokens[index] === "(") {
            index++;

            // Verificar se é Date.now()
            if (index + 2 < this.tokens.length &&
                this.tokens[index] === "Date" &&
                this.tokens[index + 1] === "." &&
                this.tokens[index + 2] === "now" &&
                this.tokens[index + 3] === "(" &&
                this.tokens[index + 4] === ")") {

                this.ast.push({ type: "PRINT_DATE_NOW", id: this.printCount++ });
                index += 5; // Pular Date.now()
            }
            // Verificar se é uma string
            else if ((this.tokens[index].startsWith('"') && this.tokens[index].endsWith('"')) ||
                (this.tokens[index].startsWith("'") && this.tokens[index].endsWith("'")) ||
                (this.tokens[index].startsWith("`") && this.tokens[index].endsWith("`"))) {

                // Remover as aspas
                let message = this.tokens[index].slice(1, -1);

                // Verificar se é um template string com interpolação
                if (this.tokens[index].startsWith("`") && message.includes("${")) {
                    let hasTemplateExpressions = false;

                    // Procurar expressões como ${end - start}
                    const templateExpressions = message.match(/\$\{([^}]+)\}/g);
                    if (templateExpressions) {
                        hasTemplateExpressions = true;

                        // Extrair e analisar cada expressão
                        const expressionNodes = [];
                        for (const exprMatch of templateExpressions) {
                            const expr = exprMatch.slice(2, -1).trim(); // Remover ${ e }

                            // Procurar expressões de subtração (end - start)
                            const subMatch = expr.match(/(\w+)\s*-\s*(\w+)/);
                            if (subMatch) {
                                const [_, var1, var2] = subMatch;
                                if (this.variables[var1] && this.variables[var2] &&
                                    this.variables[var1].type === "timestamp" &&
                                    this.variables[var2].type === "timestamp") {

                                    expressionNodes.push({
                                        type: "TIMESTAMP_DIFF",
                                        var1,
                                        var2,
                                        original: exprMatch
                                    });
                                }
                            }
                        }

                        if (expressionNodes.length > 0) {
                            this.ast.push({
                                type: "PRINT_TEMPLATE_WITH_EXPRESSIONS",
                                template: message,
                                expressions: expressionNodes,
                                id: this.printCount++
                            });
                        } else {
                            // Template string sem expressões reconhecidas
                            this.ast.push({ type: "PRINT", message, id: this.printCount++ });
                        }
                    } else {
                        // Template string sem expressões
                        this.ast.push({ type: "PRINT", message, id: this.printCount++ });
                    }
                } else {
                    // String normal
                    this.ast.push({ type: "PRINT", message, id: this.printCount++ });
                }

                index++;
            }
            // Verificar se é uma variável
            else if (this.variables[this.tokens[index]]) {
                const varName = this.tokens[index];

                this.ast.push({
                    type: "PRINT_VARIABLE",
                    name: varName,
                    id: this.printCount++
                });

                index++;
            }

            // Pular até o parêntese de fechamento
            while (index < this.tokens.length && this.tokens[index] !== ")") {
                index++;
            }

            // Pular o parêntese de fechamento
            if (index < this.tokens.length && this.tokens[index] === ")") {
                index++;
            }

            // Pular ponto e vírgula, se houver
            if (index < this.tokens.length && this.tokens[index] === ";") {
                index++;
            }
        }

        return index;
    }

    generateCCode() {
        // Cabeçalhos padrão
        let cCode = `#include <stdio.h>
#include <stdlib.h>
#include <locale.h>
#include <string.h>
#include <pthread.h>
`;
        // Se houver alguma chamada a Date.now() ou variáveis de tempo, inclui também sys/time.h
        const hasDateNow = this.ast.some(node =>
            node.type === "PRINT_DATE_NOW" ||
            node.type === "VARIABLE_ASSIGN_DATE_NOW" ||
            node.type === "PRINT_TEMPLATE_WITH_EXPRESSIONS"
        );

        if (hasDateNow) {
            cCode += `#include <sys/time.h>
long long getDateNow() {
    struct timeval te;
    gettimeofday(&te, NULL);
    long long milliseconds = te.tv_sec * 1000LL + te.tv_usec / 1000;
    return milliseconds;
}
`;
        }

        // Declarações de variáveis globais
        for (const [varName, info] of Object.entries(this.variables)) {
            if (info.type === "timestamp") {
                cCode += `long long ${varName} = 0;\n`;
            } else if (info.type === "counter") {
                cCode += `int ${varName} = 0;\n`;
            }
        }

        // Geração das funções de impressão
        let printFunctions = "";
        this.ast.forEach((node) => {
            if (node.type === "PRINT") {
                printFunctions += `void print_message_${node.id}() { printf("${node.message}\\n"); }\n`;
            } else if (node.type === "PRINT_DATE_NOW") {
                printFunctions += `void print_message_${node.id}() { printf("%lld\\n", getDateNow()); }\n`;
            } else if (node.type === "PRINT_VARIABLE") {
                const varInfo = this.variables[node.name];
                if (varInfo.type === "timestamp") {
                    printFunctions += `void print_message_${node.id}() { printf("%lld\\n", ${node.name}); }\n`;
                } else if (varInfo.type === "counter") {
                    printFunctions += `void print_message_${node.id}() { printf("%d\\n", ${node.name}); }\n`;
                }
            } else if (node.type === "PRINT_TEMPLATE_WITH_EXPRESSIONS") {
                let template = node.template;
                let formatString = "";
                let varArgs = "";

                // Substituir cada expressão no template
                for (const expr of node.expressions) {
                    if (expr.type === "TIMESTAMP_DIFF") {
                        // Substituir a expressão original por %lld
                        template = template.replace(expr.original, "%lld");
                        if (varArgs.length > 0) varArgs += ", ";
                        varArgs += `${expr.var1} - ${expr.var2}`;
                    }
                }

                if (varArgs) {
                    printFunctions += `void print_message_${node.id}() { printf("${template}\\n", ${varArgs}); }\n`;
                } else {
                    printFunctions += `void print_message_${node.id}() { printf("${template}\\n"); }\n`;
                }
            }
        });

        cCode += printFunctions;

        // Função main
        cCode += `int main() {
    setlocale(LC_ALL, "");
`;
        // Geração de código para cada nó do AST
        for (let i = 0; i < this.ast.length; i++) {
            const node = this.ast[i];

            if (node.type === "PRINT" || node.type === "PRINT_DATE_NOW" ||
                node.type === "PRINT_VARIABLE" || node.type === "PRINT_TEMPLATE_WITH_EXPRESSIONS") {
                cCode += `    print_message_${node.id}();\n`;
            } else if (node.type === "VARIABLE_ASSIGN_DATE_NOW") {
                cCode += `    ${node.name} = getDateNow();\n`;
            } else if (node.type === "FOR_LOOP") {
                // Processar loop for
                if (node.iterVar && node.initValue !== undefined && node.limitValue !== undefined) {
                    cCode += `    for (${node.iterVar} = ${node.initValue}; ${node.iterVar} < ${node.limitValue}; ${node.iterVar}++) {\n`;

                    // Processar corpo do loop
                    for (const bodyNode of node.body) {
                        if (bodyNode.type === "PRINT_COUNTER") {
                            cCode += `        printf("%d\\n", ${bodyNode.varName});\n`;
                        }
                    }

                    cCode += `    }\n`;
                }
            }
        }

        cCode += `    return 0;
}`;
        return cCode;
    }

    compileC(cCode, outputFile = "tyc_program") {
        // Criar a pasta build se não existir
        if (!fs.existsSync("build")) {
            fs.mkdirSync("build");
        }
        const outputPath = `build/${outputFile}`;
        fs.writeFileSync("temp.c", cCode);
        execSync(`gcc temp.c -o ${outputPath} -pthread`, { stdio: 'inherit' });
        fs.unlinkSync("temp.c");
        console.log(`Compilado com sucesso: ${outputPath}`);
    }

    compile(outputFile = "tyc_program") {
        this.tokenize();
        this.parse();
        const cCode = this.generateCCode();
        this.compileC(cCode, outputFile);
    }
}

if (process.argv.length < 3) {
    console.log("Uso: node tyc_compiler.js <arquivo.ts>");
    process.exit(1);
}

const tsFile = process.argv[2];
if (!fs.existsSync(tsFile)) {
    console.log(`Erro: Arquivo ${tsFile} não encontrado.`);
    process.exit(1);
}

const sourceCode = fs.readFileSync(tsFile, "utf-8");
const compiler = new TyCCompiler(sourceCode);
compiler.compile("tyc_program");
console.log("Execução do programa:");
execSync("./build/tyc_program", { stdio: 'inherit' });
