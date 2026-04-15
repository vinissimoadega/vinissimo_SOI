INSERT INTO soi.roles (role_key, role_name)
VALUES
  ('admin', 'Administrador'),
  ('manager', 'Gestor'),
  ('sales', 'Comercial'),
  ('inventory', 'Estoque'),
  ('finance', 'Financeiro')
ON CONFLICT (role_key)
DO UPDATE SET
  role_name = EXCLUDED.role_name;
