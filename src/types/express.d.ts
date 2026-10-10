// O 'export {}' é obrigatório. Ele avisa ao TypeScript que este arquivo
// é um módulo e que estamos expandindo algo existente, e não sobrescrevendo tudo.
export {};

declare global {
  namespace Express {
    export interface Request {
      user: {
        id: string;
        role: string;
        escolaId: string;
      };
    }
  }
}
