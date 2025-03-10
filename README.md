# tyc
Projeto de um novo compilador c para typescript
Instalação
Clone o repositório:

bash
git clone https://github.com/albertferreira2020/tyc.git
cd tyc_compiler
Instale as dependências:

Com Yarn:

bash
yarn install
Ou com npm:

bash
npm install
Uso
O compilador é executado via linha de comando e recebe um arquivo TypeScript como argumento.

Exemplo
Crie um arquivo de teste, por exemplo, index.ts, com o seguinte conteúdo:



console.log("Iniciando benchmark...");
console.log("Executando loop vazio 1.000.000 vezes...");
console.log(Date.now());
const start = Date.now();

for (let i = 0; i < 1000000; i++) {
  console.log(i);
}

const end = Date.now();
console.log(`Benchmark concluído em ${end - start}ms.`);
Para compilar e executar:
bash
Copiar
node tyc_compiler.js index.ts
O fluxo de execução é o seguinte:

O TyCCompiler lê o arquivo TypeScript.
Gera um arquivo C temporário (por exemplo, temp.c).
Compila o código C usando o GCC (com a flag -std=c99).
Executa o programa gerado (por padrão, o executável se chama tyc_program).
A saída do programa C deverá imprimir as mensagens, os números do laço e o resultado do benchmark conforme o esperado.

Personalização
Extensão do Parser:
Para adicionar novos recursos ou melhorar o suporte ao TypeScript, modifique as funções de tokenização (tokenize) e análise (parse) no arquivo tyc_compiler.js.

Geração do Código C:
A função generateCCode é responsável por montar o código C a partir da AST. Você pode ajustar essa função para incluir novos headers, funções ou modificar a sintaxe gerada.

Configuração do GCC:
Caso necessário, ajuste as flags de compilação na função compileC para adequar ao seu ambiente.

Limitações
Este é um projeto experimental e atualmente suporta apenas um subconjunto limitado de recursos do TypeScript. Recursos avançados como classes, herança, funções complexas e manipulação de erros não são suportados nesta versão.

Contribuição
Contribuições são bem-vindas!
Se você encontrar problemas, tiver sugestões ou desejar adicionar novos recursos, sinta-se à vontade para abrir issues ou enviar pull requests.

Licença
Este projeto está licenciado sob a Licença MIT.
