interface Categorias{
    id: number;
    nome: string;
    tipo: string;
}

interface Transações{
    id: number;
    nome: string;
    descricao: string;
    valor: number;
    Id_categoria: number;
    data: string;
}

export{    Categorias, Transações}