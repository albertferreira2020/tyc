class Pessoa {
  nome: string;
  idade: number;
  constructor(nome: string, idade: number) {
    this.nome = nome;
    this.idade = idade;
  }
}

function teste() {
  console.log("Hello, TyC!");
}

teste();

setTimeout(() => {
  console.log("Executado após 2 segundos");
}, 2000);

console.log("Iniciando benchmark...");

console.log("Executando loop vazio 1.000.000 vezes...");
console.log(Date.now());
const start = Date.now();

for (let i = 0; i < 1000000; i++) {
  console.log(i);
}

const end = Date.now();
console.log(`Benchmark concluído em ${end - start}ms.`);
