const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'EduControl Coletor Ponto',
  description: 'Serviço de Coleta de Dados do Relógio iDClass para Supabase',
  script: path.join(__dirname, 'dist', 'index.js')
});

svc.on('install', function() {
  console.log('✅ Serviço instalado com sucesso!');
  svc.start();
  console.log('🚀 Coletor rodando em segundo plano!');
});

svc.install();