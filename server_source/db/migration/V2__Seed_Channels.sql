INSERT INTO soi.channels (channel_key, channel_name, is_active)
VALUES
  ('whatsapp', 'WhatsApp', TRUE),
  ('instagram', 'Instagram', TRUE),
  ('ifood', 'iFood', TRUE),
  ('counter', 'Balcão', TRUE),
  ('other', 'Outros', TRUE)
ON CONFLICT (channel_key)
DO UPDATE SET
  channel_name = EXCLUDED.channel_name,
  is_active = EXCLUDED.is_active;
