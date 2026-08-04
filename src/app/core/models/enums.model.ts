// Enums do contrato de API (docs/api-contract.md).
// Trafegam como numero no JSON (nao como string) - confirmado via swagger.json e chamada real.

export enum UserType {
  Pf = 0,
  Pj = 1,
  Staff = 2,
  Admin = 3
}

export enum TransactionType {
  Entrada = 0,
  Saida = 1
}

export enum PaymentMethod {
  Pix = 0,
  Dinheiro = 1,
  CartaoCredito = 2,
  CartaoDebito = 3,
  Boleto = 4,
  Transferencia = 5,
  Outro = 6
}

export enum CardBrand {
  Visa = 0,
  Mastercard = 1,
  Elo = 2,
  Amex = 3,
  Outro = 4
}
