# Custo Certo

Crie um app mobile responsivo para controle de Ficha Técnica de Produtos, com foco em cálculo automático do custo real de produção a partir das matérias-primas utilizadas.

O sistema deve conter os seguintes módulos:

1. Cadastro de Matérias-Primas

Criar uma tela para cadastro básico de matérias-primas com os campos:

- Nome da matéria-prima

- Unidade de medida: kg, g, litro, ml, unidade, pacote, caixa ou outra

- Valor de compra

- Quantidade comprada referente ao valor informado

- Custo unitário calculado automaticamente

Exemplo:

Matéria-prima: Farinha

Quantidade comprada: 5 kg

Valor de compra: R$ 25,00

Custo unitário: R$ 5,00 por kg

As matérias-primas cadastradas devem ficar disponíveis em uma lista suspensa para serem selecionadas posteriormente na montagem da ficha técnica dos produtos.

2. Cadastro de Produtos

Criar uma tela para cadastro de produtos finais com os campos:

- Nome do produto

- Unidade de medida do produto: unidade, kg, g, litro, ml, porção, pacote etc.

- Valor de venda do produto

3. Ficha Técnica do Produto

Criar uma tela onde o usuário possa selecionar um produto cadastrado e montar sua ficha técnica.

A ficha técnica deve permitir:

- Selecionar matéria-prima em lista suspensa

- Informar a quantidade utilizada da matéria-prima na fabricação do produto

- Adicionar várias matérias-primas ao mesmo produto

- Editar ou remover itens da ficha técnica

- Calcular automaticamente o custo de cada matéria-prima utilizada

- Calcular automaticamente o custo total real do produto

Exemplo:

Produto: Bolo Simples  

Matéria-prima: Farinha  

Custo unitário da farinha: R$ 5,00 por kg  

Quantidade usada: 0,300 kg  

Custo na ficha técnica: R$ 1,50

4. Cálculos automáticos

O sistema deve calcular:

- Custo unitário da matéria-prima

- Custo individual de cada matéria-prima usada na ficha técnica

- Custo total do produto

- Margem bruta estimada

- Lucro bruto estimado

- Percentual de custo sobre o valor de venda

Fórmulas:

- Custo unitário da matéria-prima = Valor de compra / Quantidade comprada

- Custo do item na ficha técnica = Custo unitário da matéria-prima × Quantidade utilizada

- Custo total do produto = Soma dos custos das matérias-primas utilizadas

- Lucro bruto = Valor de venda do produto - Custo total do produto

- Margem bruta (%) = Lucro bruto / Valor de venda × 100

- Custo sobre venda (%) = Custo total do produto / Valor de venda × 100

5. Interface

O app deve ser simples, leve e próprio para celular, com:

- Tela inicial com cards de acesso rápido

- Cadastro de matérias-primas

- Cadastro de produtos

- Montagem da ficha técnica

- Lista de produtos com custo calculado

- Tela de detalhes do produto mostrando composição, custo total, valor de venda e margem

- Botões claros para adicionar, salvar, editar e excluir

6. Validações importantes

O sistema deve impedir:

- Produto sem nome

- Matéria-prima sem valor ou quantidade

- Quantidade utilizada igual ou menor que zero

- Ficha técnica sem nenhuma matéria-prima

- Cálculos com campos vazios ou inválidos

7. Relatórios básicos

Criar uma tela de relatório com:

- Lista de produtos cadastrados

- Custo real de cada produto

- Valor de venda

- Lucro bruto

- Margem bruta

- Percentual de custo sobre venda

8. Estrutura técnica

Preparar o sistema com banco de dados organizado para:

- matérias-primas

- produtos

- fichas técnicas

- itens da ficha técnica

O sistema deve ser construído com estrutura limpa, escalável e preparada para futuras melhorias, como controle de estoque, compras, produção e precificação avançada.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://iga-gestao-producao.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a82bfcfa-68c0-4fea-b49b-7d6405ba5881).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
