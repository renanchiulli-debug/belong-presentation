# Analytics da apresentação no Google Drive

Esta pasta contém o endpoint que recebe os eventos anônimos da apresentação e os grava em uma planilha Google Sheets armazenada no seu Drive.

## 1. Criar um projeto independente no Apps Script

O projeto já está configurado para gravar na planilha `Belong — Analytics da apresentação`, ID `1CviciUcEqTCm41-0ky6OSdWD0AximimKFUgnBvwrOas`.

1. Abra [script.google.com/home/projects/create](https://script.google.com/home/projects/create). Se o link direto não funcionar, abra [script.google.com](https://script.google.com), clique em **Novo projeto** e confirme que está na mesma conta da planilha.
2. Apague o conteúdo de `Code.gs` no editor do Google.
3. Copie todo o conteúdo do arquivo `google-apps-script/Code.gs` deste projeto e cole no editor.
4. Clique em **Salvar** e dê ao projeto o nome `Belong Analytics`.
5. No seletor de funções, escolha `setupAnalytics` e clique em **Executar**.
6. Autorize o script a acessar a planilha. A função confirmará a conexão com a aba `Eventos`.

Esse projeto é independente. Não é necessário usar **Extensões > Apps Script** dentro da planilha.

## 2. Publicar como Web App

1. No Apps Script, clique em **Implantar > Nova implantação**.
2. Em **Selecionar tipo**, escolha **App da Web**.
3. Em **Executar como**, escolha **Eu**.
4. Em **Quem pode acessar**, escolha **Qualquer pessoa**. Em algumas contas essa opção aparece como “Qualquer pessoa, mesmo anônima”.
5. Clique em **Implantar** e copie a URL terminada em `/exec`.

Não use a URL de teste terminada em `/dev`: ela só funciona para quem tem acesso ao editor do script.

## 3. Ligar a apresentação ao endpoint

No início de `index.html`, localize:

```html
<meta content="" name="belong-analytics-endpoint"/>
```

Cole a URL `/exec` dentro de `content`:

```html
<meta content="https://script.google.com/macros/s/SEU_ID/exec" name="belong-analytics-endpoint"/>
```

Salve, faça commit e publique novamente o site. Enquanto `content` estiver vazio, a coleta permanece desativada.

## 4. Testar

1. Abra a URL `/exec` diretamente no navegador. Ela deve mostrar `{"ok":true,...}`.
2. Abra a apresentação publicada em uma janela anônima.
3. Avance por duas ou três telas, use uma atividade e feche a página.
4. Aguarde alguns segundos e confira a aba `Eventos` da planilha.

O navegador envia eventos em lotes a cada cinco segundos, ao acumular oito eventos e ao sair da página.

## Eventos registrados

- `session_start` e `session_end`: início, retorno e duração da sessão.
- `screen_view` e `screen_leave`: tela alcançada e tempo aproximado nela.
- `resume_choice`: escolha entre continuar e reiniciar.
- `deck_switch`: troca entre resumo e apresentação completa.
- `deck_complete`: chegada à última tela de cada percurso.
- `presentation_restart`: reinício pela conclusão.
- `activity_interaction`: uso das atividades, sem registrar respostas digitadas.
- `cta_click`: clique no botão do WhatsApp.

Cada linha também contém progresso percentual, tipo de dispositivo, domínio de origem e parâmetros `utm_source`, `utm_medium` e `utm_campaign`, quando presentes. Não são enviados nome, e-mail, telefone, texto digitado, endereço IP ou URL completa.

## Análises rápidas no Google Sheets

Use **Inserir > Tabela dinâmica** sobre a aba `Eventos`.

- Alcance por sessão: linhas por `session_id`, filtro `deck = full`, valor máximo de `slide_number`.
- Abandono por tela: filtro `event_name = screen_leave`, linhas por `slide_number`, contagem de `session_id`.
- Tempo por tela: filtro `event_name = screen_leave`, linhas por `screen_title`, média de `duration_ms`.
- Conversão: filtro `event_name = cta_click`, contagem de `session_id`.
- Retomadas: filtro `event_name = resume_choice`, linhas pelo campo `metadata_json`.

## Atualizar o endpoint depois

Se você alterar `Code.gs`, abra **Implantar > Gerenciar implantações**, edite a implantação, selecione **Nova versão** e implante novamente. A URL `/exec` pode continuar a mesma.

Documentação oficial: [publicação de Web Apps no Apps Script](https://developers.google.com/apps-script/guides/web) e [serviço de planilhas do Apps Script](https://developers.google.com/apps-script/reference/spreadsheet/).
