# A3 Treinamentos

Plataforma de treinamento para colaboradores A3 Condomínios.

**Stack:** React + Vite + Supabase + Vercel + Tailwind CSS

## Estrutura

- **21 módulos** de treinamento (210 questões)
- **Admin master** cria/gerencia colaboradores
- **Dashboard** com progresso em tempo real
- **Certificados** por módulo

## Setup Rápido

1. **Clone o repo:**
   ```bash
   git clone https://github.com/ralvessindico-alt/A3-Treinamentos.git
   cd A3-Treinamentos
   ```

2. **Configure Supabase:**
   - Execute `supabase/schema.sql` no SQL Editor do seu projeto Supabase
   - Copie `Project URL` e `anon key`

3. **Crie `.env.local`:**
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=seu-anon-key
   ```

4. **Instale e rode:**
   ```bash
   npm install
   npm run dev
   ```

5. **Deploy no Vercel:**
   - Conecte repo GitHub em vercel.com
   - Adicione env vars
   - Deploy automático

## Guia Completo

Veja [README_SETUP.md](./README_SETUP.md) para instruções detalhadas.

## Licença

Interno A3 Condomínios
