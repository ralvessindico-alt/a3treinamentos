-- ═══════════════════════════════════════════════════════════════════════
-- A3 TREINAMENTOS - SQL COMPLETO COM CONTEÚDO
-- Copie e execute no Supabase SQL Editor (em partes se necessário)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. TABELA: users (colaboradores e admins)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'colaborador' CHECK (role IN ('admin', 'colaborador')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA: modules (catálogo de módulos)
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  duration TEXT,
  total_questions INT DEFAULT 10,
  total_slides INT DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA: slides (conteúdo educacional)
CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  slide_order INT NOT NULL,
  slide_type TEXT NOT NULL CHECK (slide_type IN ('cover', 'content', 'summary')),
  title TEXT,
  subtitle TEXT,
  heading TEXT,
  intro TEXT,
  blocks JSONB, -- Array de blocos {type, label, text, items, variant}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(module_id, slide_order)
);

-- 4. TABELA: questions (questões dos módulos)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  question_order INT NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer INT NOT NULL, -- Índice da resposta correta (0-3)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(module_id, question_order)
);

-- 5. TABELA: question_options (alternativas de cada questão)
CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_order INT NOT NULL,
  option_text TEXT NOT NULL,
  UNIQUE(question_id, option_order)
);

-- 6. TABELA: feedback (respostas corretas/incorretas)
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  feedback_ok TEXT NOT NULL,
  feedback_err TEXT NOT NULL,
  UNIQUE(question_id)
);

-- 7. TABELA: progress (progresso do usuário)
CREATE TABLE IF NOT EXISTS progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'em_progresso', 'concluido')),
  percentage INT DEFAULT 0,
  score INT DEFAULT 0,
  completions INT DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- ═══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

-- Users: Admin vê todos, colaborador vê só si mesmo
CREATE POLICY "users_self" ON users FOR SELECT USING (auth.uid() = id OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "users_admin_all" ON users FOR ALL USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Modules, Slides, Questions, Options, Feedback: Todos leem
CREATE POLICY "modules_read_all" ON modules FOR SELECT USING (true);
CREATE POLICY "slides_read_all" ON slides FOR SELECT USING (true);
CREATE POLICY "questions_read_all" ON questions FOR SELECT USING (true);
CREATE POLICY "question_options_read_all" ON question_options FOR SELECT USING (true);
CREATE POLICY "feedback_read_all" ON feedback FOR SELECT USING (true);

-- Progress: Cada um vê seu, admin vê todos
CREATE POLICY "progress_self" ON progress FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "progress_insert_own" ON progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress_update_own" ON progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- FUNÇÕES E TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER progress_updated_at BEFORE UPDATE ON progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- INDEXES (performance)
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_slides_module ON slides(module_id);
CREATE INDEX idx_questions_module ON questions(module_id);
CREATE INDEX idx_question_options_question ON question_options(question_id);
CREATE INDEX idx_feedback_question ON feedback(question_id);
CREATE INDEX idx_progress_user ON progress(user_id);
CREATE INDEX idx_progress_module ON progress(module_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ═══════════════════════════════════════════════════════════════════════
-- INSERIR 21 MÓDULOS (metadados)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO modules (id, title, description, category, icon, color, duration, total_questions, total_slides) VALUES
-- CONDUTA (12)
('001', 'Integração de Novos Funcionários', 'Conheça a empresa, sua função nos clientes e as regras de conduta fundamentais.', 'conduta', '🏢', '#2563EB', '30 min', 10, 6),
('002', 'Comportamento nas Áreas dos Clientes', 'Postura, circulação e uso correto dos espaços dentro dos condomínios.', 'conduta', '🏗️', '#0891B2', '25 min', 10, 5),
('003', 'LGPD e Proteção de Dados', 'Tratamento de dados pessoais, responsabilidade como operador e prevenção de incidentes.', 'conduta', '🔒', '#7C3AED', '35 min', 10, 6),
('004', 'Anticorrupção e Conflito de Interesses', 'Vantagens indevidas, presentes, comissões e integridade nas relações.', 'conduta', '⚖️', '#DC2626', '25 min', 10, 5),
('005', 'Conduta Ética e Postura Profissional', 'Valores, honestidade, comprometimento e responsabilidade no trabalho.', 'conduta', '🤝', '#059669', '20 min', 10, 4),
('006', 'Antiassédio e Ambiente de Trabalho', 'Prevenção de assédio, discriminação e construção de um ambiente respeitoso.', 'conduta', '🛡️', '#DB2777', '25 min', 10, 5),
('007', 'Jornada, Faltas e Registro de Ponto', 'Horário, pontualidade, atestados, faltas e consequências disciplinares.', 'conduta', '⏰', '#0D9488', '20 min', 10, 4),
('008', 'Celular, WhatsApp e Comunicação', 'Uso responsável de celular e ferramentas de comunicação no trabalho.', 'conduta', '📱', '#2563EB', '20 min', 10, 4),
('009', 'Uniforme, Apresentação e EPI', 'Uso obrigatório de uniforme, apresentação pessoal e equipamentos de proteção.', 'conduta', '👷', '#D97706', '20 min', 10, 4),
('010', 'Contrato, Função e Posto de Trabalho', 'Obrigações contratuais, cumprimento de ordens e mobilidade entre postos.', 'conduta', '📋', '#4F46E5', '20 min', 10, 4),
('011', 'NR-1, Saúde Mental e Riscos Psicossociais', 'Saúde mental no trabalho, riscos psicossociais e ambiente respeitoso (NR-1).', 'conduta', '🧠', '#9333EA', '25 min', 10, 5),
('014', 'Emergência, Prevenção de Incêndio e Abandono de Área', 'Condutas em emergências, prevenção de incêndio, comunicação e abandono seguro de área.', 'conduta', '🚨', '#EA580C', '30 min', 10, 6),
-- A3 CONDOSTOCK (3)
('101', 'A3 CondoStock — Conceitos & Dashboard', 'Modelo mental, acesso ao sistema e visão geral do estoque.', 'ferramentas', '🏪', '#059669', '25 min', 10, 5),
('102', 'A3 CondoStock — Requisições & Movimentação', 'Fluxo de requisição, entradas e saídas de material.', 'ferramentas', '📦', '#0D9488', '30 min', 10, 6),
('103', 'A3 CondoStock — Análises & Compras', 'Histórico, ajustes, pedido de compra automático e análises.', 'ferramentas', '📊', '#0891B2', '25 min', 10, 5),
-- A3 COTAÇÕES (3)
('201', 'A3 Cotações — Modelo Mental & Perfis', 'Como o sistema funciona: cliente, fornecedor, cotação e perfis de acesso.', 'ferramentas', '🛒', '#DC2626', '25 min', 10, 5),
('202', 'A3 Cotações — Criação & Comparação de Preços', 'Passo a passo criar cotação, lançar preços, grade comparativa.', 'ferramentas', '💰', '#EA580C', '30 min', 10, 6),
('203', 'A3 Cotações — Aprovação & Execução', 'Status de fluxo, aprovação via WhatsApp, assinatura digital, OS e impressão.', 'ferramentas', '✅', '#059669', '30 min', 10, 6),
-- A3 GESTÃO (3)
('301', 'A3 Gestão — Dashboard & Agenda', 'Visão central, KPIs, agenda de execução e navegação pelo sistema.', 'ferramentas', '📊', '#7C3AED', '25 min', 10, 5),
('302', 'A3 Gestão — Ordens de Serviço & Checklists', 'Criar OS, fluxo de execução, checklists diárias e status de conclusão.', 'ferramentas', '🔧', '#059669', '30 min', 10, 6),
('303', 'A3 Gestão — Vencimentos & Plano de Manutenção', 'Alertas de vencimentos legais, equipamentos, plano de manutenção preventiva.', 'ferramentas', '⏰', '#DC2626', '25 min', 10, 5)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- NOTA: Slides, Questions e Feedback serão inseridos via código/API
-- ═══════════════════════════════════════════════════════════════════════
-- Para adicionar todos os 21 módulos com slides e questões:
-- 1. Use um script Python/Node para gerar os INSERTs
-- 2. Ou use a API do Supabase (supabase-js) para popular
-- 3. Ou insira via admin dashboard depois
-- 
-- Por enquanto, o React carregará slides/questões do código
-- e salvará progresso no banco via esta tabela "progress"
-- ═══════════════════════════════════════════════════════════════════════
