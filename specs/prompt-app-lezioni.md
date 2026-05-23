# Specifica progetto — App di registrazione e trascrizione lezioni

> Documento da fornire a Claude Code come contesto iniziale del progetto.
> Costruire **a tappe**, non tutto in una volta. Fermarsi dopo ogni tappa per permettere il test su dispositivo reale.

---

## 0. Come usare questo documento

- **Leggi l'intero documento prima di scrivere qualsiasi codice.** Trattalo come la **fonte di verità** del progetto: in caso di dubbio, vale ciò che è scritto qui.
- **Segui le tappe nell'ordine** (sezione 12), una alla volta. Al termine di ogni tappa, fermati, spiega cosa hai creato, dimmi come testarlo sull'iPhone, e attendi la mia conferma prima di passare alla successiva.
- Le sezioni marcate **CRITICI / PRIORITARI / VINCOLANTI** (sicurezza chiavi — sez. 3, resilienza — sez. 5, integrazione Scribe — sez. 8) non sono opzionali: vanno rispettate alla lettera.
- Dove il documento dice di **verificare la documentazione ufficiale**, fallo davvero invece di assumere: versioni di moduli ed endpoint delle API possono essere cambiati.
- Se qualcosa non è specificato o è ambiguo, **chiedimi** invece di decidere in autonomia su scelte che incidono su costi, dati o architettura.

---

## 1. Obiettivo del progetto

Voglio costruire un'applicazione per **registrare lezioni universitarie su iPhone — oppure importare file audio/video già registrati — trascriverle automaticamente, archiviarle, cercarvi dentro, riassumerle con AI ed esportarle**.

L'app ha quindi **due punti d'ingresso** per l'audio: (1) la registrazione dal vivo nell'app, e (2) l'import di un file audio/video già esistente (da File/iCloud o condiviso da altre app). Una volta che l'audio è nello storage, **il flusso a valle è identico** in entrambi i casi (trascrizione → archivio → riassunto → export).

L'app è inoltre **multi-client**: un client **mobile** (iPhone) per registrare sul campo e un client **web companion** (Mac/PC via browser) per consultare, gestire e importare comodamente da computer. Entrambi condividono lo stesso backend e gli stessi dati tramite login. Vedi sezione 2 per l'architettura.

Il requisito non negoziabile è: **la registrazione deve funzionare in modo affidabile a schermo spento e con l'app in background, per ore, senza che io debba controllare il telefono.** Per questo l'app client è **nativa (React Native + Expo)**, non una web app.

---

## 2. Architettura generale

L'app è **multi-client su un unico backend**: due interfacce diverse che parlano con lo stesso server e gli stessi dati.

### A) Client mobile — React Native + Expo (TypeScript)
Gira sull'iPhone. È l'unico che **registra dal vivo** (anche in background) e gestisce l'import da mobile. Si occupa anche di visualizzazione, ricerca, esportazione.

### B) Client web companion — frontend Next.js (TypeScript)
Gira nel browser di Mac/PC. Copre consultazione e ricerca su schermo grande, lettura/modifica comoda delle trascrizioni con la tastiera, lettura riassunti, export, e **import via drag-and-drop** dal computer. **Può anche registrare**: dal microfono e — per le lezioni online — catturando l'audio del computer (vedi sezione 4-ter per i requisiti e i limiti tecnici). Login con lo stesso account, stessi dati dell'app mobile.

> Nota: il **mobile resta il client primario per registrare sul campo** (in aula, telefono in tasca, robustezza in background). La registrazione web è una comodità per chi è già al computer (tipicamente lezioni online), e non offre la stessa affidabilità in background del nativo: una registrazione nel browser dura finché la scheda resta aperta e il computer attivo.

### C) Backend — Next.js (TypeScript) su Railway
Espone API. Custodisce **tutte** le chiavi segrete. Si occupa di: generare presigned URL per lo storage, ricevere i job di trascrizione, chiamare l'API di ElevenLabs (Scribe v2), chiamare l'API di Anthropic per i riassunti, persistere i dati in PostgreSQL. **Serve entrambi i client** (mobile e web) con le stesse API.

> **Principio architetturale chiave**: il backend deve essere **agnostico rispetto al client**. Le API non devono mai presupporre "solo app mobile": qualunque logica (autenticazione, upload, trascrizione, lettura dati) deve funzionare identica sia per il client mobile sia per quello web. Poiché il backend è già Next.js, **il client web riusa lo stesso progetto Next.js** (Next.js fa sia API sia frontend web) — non è un secondo progetto da zero, ma il frontend web dello stesso backend. Il client mobile (Expo) resta un progetto separato che consuma le stesse API.

### Servizi su Railway
- **Servizio Next.js** (unico con dominio pubblico) — serve sia le API sia il frontend web companion
- **PostgreSQL** (gestito da Railway, accesso via `DATABASE_URL` come reference variable)
- **Object storage S3-compatibile** per i file audio
- **Worker** in background per le trascrizioni lunghe (può essere aggiunto in una tappa successiva)

### Diagramma del flusso
```
iPhone (Expo) --registra/importa--> file audio        Mac/PC (browser)
   |  1. richiede presigned URL                          |  consulta, modifica,
   v                                                      |  esporta, importa (drag&drop)
Next.js (Railway) — API + frontend web companion <--------+
   |  2. carica file nello storage    (stesse API per entrambi i client)
   |  3. crea job di trascrizione
   v
Worker --scarica audio--> Scribe v2 (ElevenLabs) --> trascrizione
   |  4. salva risultato
   v
PostgreSQL <--entrambi i client leggono trascrizioni e riassunti
   ^
   |  riassunti: Next.js API --> Anthropic API
```

---

## 3. Requisiti di sicurezza (CRITICI)

- Le chiavi `ELEVENLABS_API_KEY` e `ANTHROPIC_API_KEY` e le credenziali del DB vivono **solo** come variabili d'ambiente sui servizi backend Railway. **Mai** nel codice dell'app Expo, mai inviate al client.
- L'app Expo non chiama **mai** direttamente ElevenLabs o Anthropic: passa sempre dal backend.
- In Next.js, nessuna chiave segreta deve avere il prefisso `NEXT_PUBLIC_`.
- I file audio si caricano con il pattern **presigned URL**: il client chiede al backend un URL firmato e carica il file direttamente nello storage, senza farlo transitare dal server.

---

## 4. Requisiti funzionali della registrazione (il cuore dell'app)

La schermata di registrazione deve avere:

1. **Registrazione in background reale**: l'audio continua a registrarsi con app in background e schermo spento. Configurare correttamente le capability audio in background di iOS (`UIBackgroundModes: audio`) e i permessi microfono.
2. **Pausa e ripresa**: poter mettere in pausa (es. intervallo a metà lezione) e riprendere **nello stesso file**, ottenendo un'unica registrazione continua senza interruzioni percepibili.
3. **Timer che riflette il tempo reale di registrazione**: si ferma in pausa e riprende da dove era (non conteggia il tempo di pausa).
4. **Indicatore di stato visivo inequivocabile**: deve essere evidente se si sta registrando, è in pausa, o è fermo.
5. **Salvataggio progressivo / resistenza ai crash**: l'audio deve essere persistito localmente in modo che un crash o una chiusura improvvisa non faccia perdere l'intera registrazione.
6. **Permessi**: gestire richiesta ed eventuale rifiuto del permesso microfono con messaggi chiari.
7. **Formato audio**: registrare in un formato compresso ragionevole (es. AAC/m4a) per file gestibili, compatibile con l'API di trascrizione.
8. **Pausa vs. Termina (due azioni distinte)**: la **pausa** sospende temporaneamente e consente la ripresa nello stesso file; lo **stop/termina** chiude definitivamente la registrazione, finalizza il file audio e avvia il flusso di upload + trascrizione. Lo stop deve richiedere una **conferma esplicita** (es. action sheet "Terminare la registrazione?") per evitare di terminare per errore una lezione; la pausa invece non richiede conferma.
9. **Assegnazione del titolo** (vedi flusso completo in sezione 7.2): all'avvio l'app assegna un **titolo provvisorio automatico** (es. data/ora) in modo che la registrazione non resti mai senza nome; al momento dello stop l'app mostra una schermata "Salva lezione" con titolo precompilato e selettore materia, modificabili; il titolo resta sempre modificabile in seguito dal dettaglio.

### 4-bis. Import di audio/video già esistente (secondo punto d'ingresso)

Oltre alla registrazione dal vivo, l'app deve permettere di **importare un file audio/video già registrato** (es. memo vocale, registrazione da un altro dispositivo, lezione online registrata). Una volta importato, il file entra nello stesso identico flusso della registrazione (upload → trascrizione → archivio → riassunto → export): cambia solo l'ingresso.

Requisiti:
1. **Fonti di import (tutte)**:
   - **Selettore file**: import da app File / iCloud Drive tramite document picker nativo.
   - **Condivisione da app esterne**: l'app deve comparire nel menu "Condividi" di iOS (share extension), così da poter ricevere un file audio/video da Memo Vocali, WhatsApp, Mail, ecc.
2. **Formati accettati**: tutti i formati supportati da Scribe (vedi sezione 10 — audio: AAC, M4A, MP3, WAV, OPUS, WebM, FLAC, ecc.) **più i file video** (es. MP4/MOV da lezioni Zoom/Teams). Per i video, estrarre o inviare la traccia audio per la trascrizione (verificare se Scribe accetta direttamente il video o se serve estrarre l'audio lato app/backend).
3. **Flusso identico a valle**: dopo l'import, creare un record `lesson` esattamente come per una registrazione, assegnare titolo provvisorio (dal nome del file o data), permettere di impostare titolo/materia, e avviare la trascrizione.
4. **Validazione e feedback**: gestire file non supportati, troppo grandi (limite Scribe: 3 GB / 10 ore — sezione 10) o corrotti con messaggi chiari, senza far fallire silenziosamente l'import.
5. **Origine tracciata**: distinguere nello schema se la lezione proviene da registrazione o da import (campo `source`), utile per la UX e per eventuali differenze di gestione.

### 4-ter. Registrazione dalla web app (Mac/PC)

Il client web può registrare, come comodità per chi è già al computer (tipicamente lezioni online). Funzione **secondaria** rispetto al mobile, che resta il client primario per la registrazione sul campo.

1. **Registrazione da microfono**: usare l'API `MediaRecorder` del browser per registrare dal microfono del computer. Una volta terminata, la registrazione confluisce nello stesso flusso (record `lesson`, upload, trascrizione) degli altri ingressi. Affidabile, equivalente alla registrazione mobile ma senza background (vedi limite sotto).
2. **Registrazione dell'audio del computer (lezioni online)**: per catturare l'audio in uscita dal computer (es. la voce del docente su Zoom/Teams), usare l'API `getDisplayMedia` con `audio: true` (condivisione scheda/schermo con audio). **Avvertenze tecniche da gestire e comunicare all'utente**:
   - Il supporto alla cattura dell'audio di sistema **varia molto tra browser e sistemi operativi** (in genere migliore su Chrome/Edge con la condivisione di una scheda; più limitato altrove e su macOS per l'audio di sistema completo).
   - Spesso richiede che l'utente selezioni esplicitamente "condividi audio della scheda/schermo".
   - Implementare con **graceful degradation**: se la cattura audio di sistema non è disponibile, spiegarlo chiaramente e suggerire l'alternativa più robusta, cioè **importare il file** della registrazione (molte piattaforme di videoconferenza forniscono la registrazione scaricabile) — funzione già prevista in sezione 4-bis.
3. **Limite di affidabilità (da comunicare nell'UX)**: una registrazione nel browser dura finché la scheda resta aperta e il computer è attivo; se l'utente chiude la scheda/il browser o il computer va in sospensione, la registrazione si interrompe. Il browser **non** offre la robustezza in background dell'app nativa. Per registrazioni lunghe e critiche sul campo, indirizzare al client mobile.
4. **Flusso a valle identico**: indipendentemente dalla sorgente (microfono o audio di sistema), a fine registrazione si crea un record `lesson` (con `source = recording`) e parte il consueto flusso upload → trascrizione.

---

## 5. Resilienza e gestione dei failure (REQUISITI PRIORITARI)

> Principio guida di tutta l'app: **presumere che ogni passaggio possa fallire, e fare in modo che il dato non vada mai perso, solo "in attesa".** Il flusso di sicurezza è: audio scritto su disco immediatamente → tenuto localmente finché non è caricato con successo → tenuto finché non è trascritto con successo → ogni operazione deve essere ritentabile. Costruita così, l'app al massimo fa *aspettare*, non fa mai *perdere*.

### 5.1 Protezione dell'audio durante la registrazione (failure più grave: perdita irreparabile)
- **Scrittura su file progressiva, non in memoria**: l'audio va scritto su disco mentre si registra, mai accumulato solo in RAM. Se l'app crasha, il file parziale deve essere già presente su disco.
- **Recupero all'avvio**: all'apertura, l'app rileva se esiste una registrazione interrotta in modo anomalo (non chiusa correttamente) e propone all'utente di recuperarla, invece di ignorarla.
- **Controlli pre-registrazione**: prima di iniziare, verificare batteria sufficiente e spazio su disco disponibile; avvisare l'utente *prima* se sono insufficienti per una registrazione lunga.
- **Nessuna cancellazione prematura del file locale**: il file audio sul dispositivo NON deve essere cancellato finché non c'è conferma certa che è stato (a) caricato sul backend E (b) trascritto con successo. Il locale è la copia di sicurezza.
- **Persistenza dello stato di sessione (incluso lo stato di pausa)**: oltre all'audio, persistere su disco anche i **metadati della sessione di registrazione** — tempo trascorso, stato (in corso / in pausa), segnalibri, titolo provvisorio. Questo copre lo scenario reale in cui l'utente mette in **pausa** la registrazione e poi l'app viene chiusa o terminata da iOS (es. pausa caffè con app in background, terminata dal sistema per liberare memoria). Alla riapertura l'app deve poter ricostruire esattamente dove si era — anche se era in pausa — e proporre di riprendere o di finalizzare la parte già registrata. Tenere presente che su iOS un'app **in pausa** è più esposta alla terminazione di una che registra attivamente: lo stato va quindi salvato a ogni transizione (avvio, pausa, ripresa, bookmark) e non solo alla fine.

### 5.2 Robustezza dell'upload
- **Coda di upload con retry automatico**: se l'upload fallisce (perdita di rete, server irraggiungibile), il file resta in coda e l'app riprova automaticamente quando la connettività torna, senza azione dell'utente.
- **Upload ripristinabile (resumable) se possibile**: per file grandi su rete mobile, preferire upload a blocchi che riprendono dal punto di interruzione. Se troppo complesso nella prima versione, garantire almeno il retry completo automatico.
- **Stati espliciti e onesti per ogni lezione**: l'utente deve sempre sapere cosa è al sicuro e cosa no. Stati minimi: `registrata (non caricata)` / `in upload` / `caricata (in trascrizione)` / `pronta` / `fallita`.

### 5.3 Robustezza della trascrizione
- **Idempotenza**: un job di trascrizione ritentato dopo un fallimento parziale NON deve creare doppioni né generare doppi addebiti. Ogni job deve essere progettato per essere ritentabile in sicurezza.
- **Gestione esplicita degli errori dell'API**: gestire timeout/errori/risposte anomale di ElevenLabs con uno stato `failed` e un'azione "riprova". Una lezione non deve mai restare bloccata per sempre in stato "in trascrizione" senza spiegazione.
- **L'audio sopravvive al fallimento della trascrizione**: il file audio nello storage resta integro anche se la trascrizione fallisce ripetutamente, così è sempre possibile riprovare.

### 5.4 Failure trasversali
- **Backup / export come via di fuga**: i dati non devono dipendere esclusivamente dalla disponibilità dei servizi Railway. Prevedere un meccanismo di "esporta tutto" per non rischiare di perdere un intero semestre di lezioni.
- **Controllo dei costi API**: prevenire failure silenziosi in cui un bug genera chiamate ripetute a ElevenLabs/Anthropic. Loggare ogni chiamata API con costo stimato; prevedere, se possibile, un tetto o un allarme di spesa.
- **Permessi negati gestiti con grazia**: se il permesso al microfono è negato, l'app spiega chiaramente come riattivarlo dalle impostazioni iOS, invece di limitarsi a non funzionare.

### 5.5 Test dei failure (da fare prima di fidarsi dell'app)
Predisporre/documentare come testare deliberatamente i casi di fallimento: crash dell'app durante la registrazione, perdita di rete durante l'upload (modalità aereo), batteria scarica, permesso negato. I failure vanno verificati quando non contano, non durante una lezione vera.

### 5.6 Comportamento offline e gestione della connessione
> Scelta di prodotto: **offline-first per la consultazione**. Lo studente spesso ripassa proprio dove non c'è rete (treno, metro, biblioteca interrata), quindi i contenuti devono essere fruibili offline. Modello "tipo Spotify": il **testo** di tutte le lezioni è sempre disponibile offline (leggero), l'**audio** è scaricabile su richiesta per singola lezione (pesante). Ciò che richiede rete (nuove trascrizioni, nuovi riassunti, sincronizzazione, upload) va messo in coda con pazienza, mai fatto fallire.

- **Testo sempre offline (cache locale)**: trascrizioni (verbatim e pulita), riassunti, segmenti/timestamp e metadati delle lezioni vanno mantenuti in una cache locale sul dispositivo, così l'utente può **leggere, navigare e cercare** in tutte le lezioni anche senza connessione. Sincronizzare in background quando la rete è disponibile.
- **Audio scaricabile su richiesta**: l'audio NON viene tenuto offline di default (pesa troppo). L'utente può scaricare l'audio di singole lezioni per il riascolto offline ("Scarica per offline" per lezione), con indicazione dello stato (non scaricato / in download / disponibile offline) e possibilità di rimuovere il download per liberare spazio.
- **La registrazione è indipendente dalla rete**: registrare è un'operazione locale. L'utente deve poter registrare un'intera lezione **senza alcuna connessione**; l'audio si salva in locale e viene caricato quando torna la rete (conseguenza del salvataggio locale, sezione 5.1).
- **Coda paziente per le operazioni che richiedono rete**: upload, avvio trascrizione, generazione riassunti e sincronizzazione, se manca la connessione, restano in coda e partono automaticamente al ritorno del segnale, senza azione dell'utente e senza messaggi d'errore frustranti (un "in attesa di connessione" invece di un "errore").
- **Retry con backoff esponenziale**: i ritentativi su rete instabile usano attese crescenti (es. 2s, 5s, 10s…). Combinare con l'idempotenza (sezione 5.3) così un retry non genera mai doppioni o doppi addebiti.
- **Gestione dei mezzi-fallimenti**: su segnale debole una richiesta può partire e morire a metà; usare timeout ragionevoli e considerare fallita una richiesta non confermata, rimettendola in coda.
- **Risvolto UX (vedi sezione 7.5)**: mostrare onestamente lo stato di connessione, della coda e dei download offline, così l'utente sa sempre cosa è disponibile offline, cosa è al sicuro e cosa è solo in attesa.

---

## 6. Funzionalità complete (l'intera app)

- **Registra**: in-app, con pausa/ripresa e background (sezione 4).
- **Importa audio/video esistente**: secondo punto d'ingresso (sezione 4-bis) — da File/iCloud o condiviso da altre app; stesso flusso a valle della registrazione.
- **Archivio**: lista di tutte le lezioni con titolo, data, durata, stato (registrata / in trascrizione / trascritta).
- **Trascrizione**: via ElevenLabs Scribe v2, con timestamp a livello di parola e distinzione dei relatori (diarization). Lingua principale: **italiano** (verificare il parametro lingua corretto dell'API, o lasciare autodetect).
- **Visualizzazione lezione**: testo della trascrizione leggibile, navigabile, con i timestamp.
- **Disponibilità offline** (vedi sezione 5.6): il testo di tutte le lezioni (trascrizioni, riassunti, segmenti) è consultabile e ricercabile offline tramite cache locale; l'audio è scaricabile su richiesta per il riascolto offline, con possibilità di rimuovere il download per liberare spazio.
- **Ricerca**: ricerca full-text su tutte le trascrizioni archiviate (funzionante anche offline sul testo in cache).
- **Riassunti AI**: pulsante per generare, tramite API Anthropic, un riassunto strutturato della lezione (punti chiave, concetti principali). Salvare il riassunto nel DB.
- **Download e esportazione**:
  - **Download del file audio originale**: per ogni lezione, poter riscaricare la registrazione grezza (.m4a) dall'object storage, tramite link temporaneo generato dal backend.
  - **Export della trascrizione grezza Scribe** (PRIMA del riassunto): voce di export **distinta e indipendente**, sempre disponibile anche se non è mai stato generato un riassunto. Permette di scaricare la trascrizione grezza in entrambe le versioni — verbatim (con filler) e pulita (senza filler) — in formato **.txt**, più opzionalmente i dati completi **.json** (timestamp/speaker). Questa è la "fonte pura" non toccata da Anthropic.
  - **Export del testo elaborato**: per ogni lezione, esportare trascrizione + riassunto in formato **testo (.txt)** e **PDF**.
  - **Esporta tutto (backup)**: poter scaricare in blocco tutte le lezioni archiviate (audio e/o testo) in una sola operazione, come backup di fine semestre. Questa funzione è anche la "via di fuga" prevista dalla sezione 5.4 (i dati non devono dipendere solo dalla disponibilità di Railway).

---

## 7. Esperienza utente (UX)

> Queste funzioni determinano se l'app verrà usata davvero nel quotidiano. Sono organizzate per area; l'ordine di implementazione è indicato nelle tappe (sezione 12).

### 7.1 Attesa e stato della trascrizione
- **Feedback vivo durante l'elaborazione**: mentre Scribe trascrive (può richiedere minuti su lezioni lunghe), mostrare avanzamento o almeno una stima ("trascrizione in corso, di solito ~X minuti"), mai un semplice stato fermo ambiguo.
- **Lavorazione in background**: l'utente può chiudere l'app e ritrovare la trascrizione pronta al ritorno. L'app deve comunicarlo chiaramente. Coerente con l'uso dei webhook (sezione 10 — integrazione Scribe).
- **Notifica push a trascrizione pronta**: notificare "La trascrizione di [lezione] è pronta" invece di obbligare l'utente a controllare. Funzione ad alta priorità, coerente col requisito di non dover sorvegliare il telefono.

### 7.2 Organizzazione dell'archivio
- **Titolo — flusso completo di assegnazione**. L'utente non deve mai essere costretto a digitare, ma deve sempre poter correggere. Il flusso previsto:
  1. **Provvisorio automatico all'avvio**: appena inizia la registrazione, assegnare un titolo provvisorio sensato (es. "Lezione 23 mag, 9:14"), così la lezione ha sempre un nome.
  2. **Conferma allo stop**: quando l'utente termina la registrazione, mostrare una schermata "Salva lezione" con il titolo precompilato (il provvisorio) e il selettore della materia, entrambi modificabili in un solo passaggio.
  3. **Rinomina dal dettaglio**: il titolo (e la materia) restano sempre modificabili dalla schermata di dettaglio della lezione.
  4. **Suggerimento AI (opzionale)**: quando viene generato il riassunto (Anthropic), proporre automaticamente un titolo descrittivo estratto dal contenuto della lezione, che l'utente può accettare con un tap o modificare.
- **Materia / corso**: poter assegnare una materia o un corso (tag o cartelle) per organizzare decine di lezioni in un semestre. Assegnabile sia allo stop sia in seguito.
- **Rinomina e modifica**: poter correggere titolo, materia, e **modificare il testo della trascrizione** (per correggere errori di Scribe su termini specifici). Le modifiche alla trascrizione vanno nel campo `transcriptEdited`, senza toccare i campi grezzi.
- **Cancellazione con conferma**: poter eliminare lezioni (prove, doppioni), sempre con una conferma esplicita per evitare perdite accidentali.

### 7.3 Durante la registrazione
- **Bookmark al volo**: durante la registrazione, un pulsante "segna questo punto" che salva un marcatore con timestamp, poi ritrovabile nella trascrizione. Funzione molto utile per uno studente.
- **Indicatore di livello audio**: una visualizzazione del livello del microfono che si muove con la voce, per avere conferma visiva che si sta captando audio reale e non silenzio.

### 7.4 Recupero e studio
- **Ricerca che riporta al punto esatto**: la ricerca full-text non deve solo indicare in quale lezione si trova un termine, ma portare al punto preciso della trascrizione (e idealmente dell'audio) dove è stato detto, sfruttando i timestamp parola-per-parola di Scribe.
- **Tocca il testo per riascoltare l'audio**: toccando una frase della trascrizione, l'audio parte da quel punto. Funzione chiave per lo studio (leggi → non torna un passaggio → tocchi → riascolti).

### 7.5 Fiducia e controllo
- **Stato di sincronizzazione a colpo d'occhio**: icona/etichetta chiara per ogni lezione che indica dov'è il dato (solo locale / caricato / trascritto / con riassunto), così l'utente sa sempre cosa è al sicuro nel cloud. Risvolto UX dei requisiti di resilienza (sezione 5).
- **Indicatore di utilizzo/costo**: piccolo indicatore del consumo stimato (Scribe a consumo + chiamate Anthropic) per evitare sorprese e dare senso di controllo. Coerente col controllo costi della sezione 5.4.
- **Indicatore di connessione, coda e offline**: mostrare in modo discreto ma chiaro lo stato della connettività, cosa è in attesa (es. "2 lezioni in attesa di caricamento", "trascrizione in coda — riprenderà online") e quali lezioni hanno l'audio disponibile offline. Risvolto UX della gestione di rete (sezione 5.6): l'utente deve sempre sapere cosa è disponibile offline, cosa è al sicuro e cosa è solo in coda.

---

## 8. Design e riferimento visivo

> È allegato a questo progetto un file mockup React (`mockup-app-lezioni-ios.jsx`). **Usalo come riferimento visivo dell'aspetto e dei flussi, NON come codice da copiare**: il mockup è scritto in React per web, mentre l'app è in React Native + Expo. Traduci l'estetica e i pattern di interazione nei componenti nativi equivalenti.

**Direzione estetica**: pulita, professionale, in stile Apple/iOS, **palette neutra** (niente accenti colorati vivaci). Sobrietà ordinata, molto spazio bianco, gerarchia tipografica chiara.

**Colori** (palette neutra):
- Sfondo app: grigio chiarissimo (`#F4F4F5`)
- Card / superfici: bianco (`#FFFFFF`)
- Separatori: `#E4E4E7`
- Testo primario: quasi nero (`#18181B`)
- Testo secondario: `#71717A`; terziario: `#C4C4C8`
- **Accento**: grafite/nero (`#27272A`) — usato per pulsanti primari, controlli attivi, link di navigazione. **Niente blu iOS o colori accesi.**
- Materie: differenziate con una scala di grigi (non con colori vivaci).
- **Unica eccezione cromatica**: il rosso (`#FF3B30`) è ammesso **solo** per lo stato "REC" e il pulsante "Termina" durante la registrazione, perché è una convenzione funzionale universale.

**Tipografia**: font di sistema (San Francisco su iOS). Titoli in peso 600–700 con letter-spacing leggermente negativo; timer della registrazione in peso leggero (300). Numeri tabellari per timer e timestamp.

**Layout delle schermate** (vedi mockup):
- **Home / Archivio**: titolo grande in alto, barra di ricerca, lista raggruppata stile iOS (card bianca con righe separate). Ogni riga: tile icona a sinistra (tinta neutra della materia), titolo + sottotitolo, durata · data e icona di stato sync, chevron a destra. Pulsante "Nuova registrazione" fisso in basso con sfumatura di sfondo.
- **Registrazione**: stato REC/pausa in alto a destra con pallino, materia + timer grande al centro, visualizzatore di livello audio (barre), conteggio segnalibri. In basso tre controlli tondi con etichetta sotto: "Segna" (bookmark), "Pausa/Riprendi" (tondo grande centrale), "Termina" (rosso). Lo stop apre un action sheet di conferma stile iOS.
- **Dettaglio lezione**: nav bar traslucida (blur), card header con badge materia + titolo + metadati + tre azioni rapide (Audio / Esporta / Riassumi). Sotto, un **segmented control** con le tre versioni del testo (Grezza / Pulita / Riassunto) e la trascrizione in card con righe separate (timestamp, speaker, testo; segnalibri evidenziati). Tocco su una frase = evidenziazione + riascolto da quel punto.

**Interazioni**: micro-animazioni discrete (fade-in dei contenuti, leggero scale al tap), niente effetti vistosi. Coerenza con le convenzioni iOS native.

---

## 9. Stack tecnico

**Client mobile (iPhone)**
- React Native con Expo (TypeScript)
- Modulo audio Expo per registrazione in background (verificare il modulo audio Expo corrente e supportato)
- Test su iPhone tramite Expo Go o development build

**Client web companion (Mac/PC)**
- Frontend Next.js (React, TypeScript) — **lo stesso progetto del backend** (Next.js serve sia API sia pagine web)
- Consultazione, ricerca, modifica trascrizioni, lettura riassunti, export, import via drag-and-drop, e registrazione da microfono / audio del computer (`MediaRecorder` e `getDisplayMedia` — sezione 4-ter). Il mobile resta il client primario per la registrazione sul campo.

**Backend** (serve entrambi i client con le stesse API)
- Next.js (TypeScript): API routes + frontend web companion
- Prisma come ORM
- PostgreSQL (Railway)
- Object storage S3-compatibile (Railway)
- **Autenticazione**: sistema di login condiviso tra i due client (lo stesso account vede gli stessi dati su mobile e web). Le lezioni vanno associate all'utente proprietario nello schema (`userId`).
- Deploy su Railway con `output: "standalone"` in `next.config` e pre-deploy command `npx prisma migrate deploy`

**API esterne**
- ElevenLabs Speech-to-Text (Scribe v2) per la trascrizione
- Anthropic API per i riassunti

---

## 10. Specifiche integrazione ElevenLabs Scribe (VINCOLANTI)

> Questi parametri sono stati verificati sulla documentazione ufficiale ElevenLabs. Non sostituire il provider né improvvisare gli endpoint.

- **Provider esclusivo**: usare **esclusivamente** l'API Speech-to-Text di ElevenLabs, modello **Scribe v2 in modalità batch** (asincrona). NON usare Scribe v2 Realtime, NON usare Whisper/OpenAI/Google o qualsiasi altro provider per la trascrizione. Se il modello batch corretto risultasse diverso al momento dell'implementazione, verificarlo sulla doc ufficiale prima di procedere.
- **Endpoint**: Speech to Text `/convert`. Host delle chiamate: `api.elevenlabs.io`. Riferimento: `https://elevenlabs.io/docs/api-reference/speech-to-text/convert`.
- **Autenticazione**: tramite `ELEVENLABS_API_KEY` come variabile d'ambiente sul backend. Mai nel client.
- **Lingua**: italiano (codice `ita`) oppure smart language detection. L'italiano è in fascia di accuratezza massima (WER ≤ 5%).
- **Funzioni da attivare**:
  - **Diarization** (distinzione relatori, fino a 32) — per separare docente e interventi.
  - **Timestamp a livello di parola** — per navigare la trascrizione.
  - **Keyterm prompting** (batch: fino a 1000 termini) — valutare di passare la terminologia specifica del corso (nomi propri, termini tecnici) per migliorarne la trascrizione.
  - **No verbatim mode** (`no_verbatim`): servono **entrambe** le versioni della trascrizione e vanno **sempre** salvate, a prescindere dal riassunto:
    - versione **verbatim** (con filler words, esitazioni, false partenze) → campo `transcriptVerbatim`;
    - versione **pulita** (`no_verbatim` attivo, senza filler) → campo `transcriptClean`.
    Verificare sulla doc se ciò richiede due chiamate distinte o una sola con post-elaborazione, e scegliere l'approccio più efficiente in termini di costo. Salvare in ogni caso anche il JSON completo (`transcriptSegments`).
- **Asincronia / webhook**: l'API supporta la consegna dei risultati via **webhook** per le trascrizioni asincrone. Preferire questo approccio in combinazione col worker (sezione architettura): inviare il file, ricevere il risultato via webhook quando pronto, invece di tenere aperta una richiesta per minuti. Questo è coerente con i requisiti di resilienza (sezione 5.3).
- **Vincoli file** (verificati): supporto fino a 3 GB e 10 ore in modalità standard; formati audio accettati includono AAC, M4A, MP3, WAV, OPUS, WebM, FLAC. Il formato di registrazione scelto (m4a/AAC) è compatibile.
- **Verifica d'uso (prova del nove)**: per avere certezza che si stia usando ElevenLabs, controllare che (1) le chiamate vadano a `api.elevenlabs.io`, (2) usino `ELEVENLABS_API_KEY`, (3) i minuti consumati compaiano nella dashboard di utilizzo dell'account ElevenLabs dopo la prima trascrizione.
- **Test isolato prima dell'integrazione**: nella Tappa 3, prima di integrare Scribe nell'intera app, creare un piccolo script standalone che trascrive un file audio di prova e stampa il risultato JSON, per confermare che l'integrazione funzioni. Solo dopo incapsularlo nel flusso dell'app.

---

## 11. Schema dati iniziale (Prisma — tabella `lessons`)

- `id`
- `userId` (proprietario della lezione — necessario per il login condiviso tra client mobile e web)
- `title` (modificabile dall'utente)
- `subject` (materia/corso, opzionale — per organizzazione e filtri)
- `recordedAt` (data/ora)
- `source` (origine della lezione: `recording` | `import` — registrata dal vivo o importata da file)
- `durationSeconds`
- `audioUrl` (percorso nello storage)
- `status` (enum: `recorded` | `transcribing` | `transcribed` | `failed`)
- `syncState` (stato di sincronizzazione per la UX: `local_only` | `uploaded` | `transcribed` | `summarized`)
- `offlineAudioState` (stato del download audio per l'offline: `not_downloaded` | `downloading` | `available_offline`; il testo è sempre in cache locale, l'audio si scarica su richiesta)
- `bookmarks` (JSON: lista di marcatori con timestamp creati durante la registrazione)
- `transcriptVerbatim` (testo grezzo COMPLETO da Scribe, **con** filler words / esitazioni / false partenze — la fonte più fedele)
- `transcriptClean` (testo grezzo da Scribe **senza** filler words — versione leggibile, prodotta con `no_verbatim`)
- `transcriptEdited` (testo della trascrizione modificato dall'utente, opzionale — non sovrascrive i campi grezzi)
- `transcriptSegments` (JSON completo da Scribe: segmenti con timestamp a livello di parola, speaker, eventi audio)
- `summary` (testo, opzionale — generato da Anthropic, **separato** e additivo: non sostituisce mai i campi sopra)
- `createdAt`, `updatedAt`

> **Regola fondamentale**: i campi `transcriptVerbatim`, `transcriptClean` e `transcriptSegments` sono la trascrizione grezza di Scribe e **non devono mai essere modificati, sovrascritti o rielaborati** né dal riassunto di Anthropic né dalle modifiche manuali dell'utente. Il riassunto va nel campo `summary`; le eventuali correzioni manuali dell'utente vanno nel campo separato `transcriptEdited`. La fonte pura (i campi grezzi) resta sempre intatta.

Adatta/estendi liberamente se necessario.

---

## 12. Ordine di lavoro (TAPPE — fermarsi dopo ognuna)

**Tappa 1 — App Expo + registrazione**
Crea l'app Expo (TypeScript) con: schermata lista lezioni (per ora vuota/locale), pulsante grande "Registra", schermata di registrazione completa di tutti i requisiti della **sezione 4** (background, pausa/ripresa, timer, indicatore di stato, salvataggio locale, permessi, **conferma allo stop**, **titolo provvisorio automatico** + schermata "Salva lezione" allo stop), dei requisiti di resilienza pertinenti della **sezione 5.1** (scrittura su file progressiva, recupero all'avvio dopo crash, controlli pre-registrazione, nessuna cancellazione prematura del locale) e delle funzioni UX di registrazione della **sezione 7.3** (bookmark al volo con timestamp, indicatore di livello audio). Le registrazioni per ora restano salvate solo localmente sul dispositivo.

**Tappa 2 — Backend + storage + upload + import**
Crea il backend Next.js su Railway con Prisma, schema della **sezione 11**, e un'API route che genera presigned URL per l'object storage. Collega l'app Expo: a fine registrazione carica il file audio nello storage tramite l'URL firmato e crea il record `lesson`. Implementa qui i requisiti di robustezza dell'upload della **sezione 5.2** (coda con retry automatico, stati espliciti, e — se fattibile — upload ripristinabile). Mostra lo stato di sincronizzazione nell'archivio (**sezione 7.5**: solo locale / caricato / ...). Implementa inoltre il **secondo punto d'ingresso — import di audio/video esistente** (sezione 4-bis): document picker da File/iCloud + share extension per ricevere file da altre app, validazione formati/dimensioni, ed estrazione audio per i video. Un file importato confluisce nello stesso flusso (stesso record `lesson`, campo `source = import`).

**Tappa 3 — Trascrizione**
Aggiungi l'integrazione con ElevenLabs Scribe v2 seguendo **rigorosamente la sezione 10** (provider esclusivo, modalità batch, endpoint, funzioni da attivare, webhook). Inizia con il **test isolato** descritto nella sezione 10 (script standalone che trascrive un file di prova), poi crea l'API route/worker che prende l'audio dallo storage, lo invia a Scribe, e salva nel DB **entrambe le versioni grezze** (`transcriptVerbatim` e `transcriptClean`) più il JSON completo (`transcriptSegments`), aggiornando `status`. L'app mostra lo stato e poi la trascrizione, con il feedback di attesa e la notifica push della **sezione 7.1**. Applica i requisiti della **sezione 5.3** (idempotenza dei job, stato `failed` con "riprova", audio che sopravvive ai fallimenti).

**Tappa 4 — Archivio, organizzazione e ricerca**
Implementa lista completa con stati e stato di sincronizzazione (**sezione 7.5**), e le funzioni di organizzazione della **sezione 7.2** (titolo modificabile, materia/corso, rinomina, modifica della trascrizione in `transcriptEdited`, cancellazione con conferma). Implementa la **cache locale del testo** (trascrizioni, riassunti, segmenti) per la consultazione e ricerca offline (**sezione 5.6**). Implementa la ricerca full-text della **sezione 7.4** che riporta al punto esatto della trascrizione sfruttando i timestamp parola-per-parola, funzionante anche offline.

**Tappa 5 — Riassunti AI**
API route che manda il testo della lezione all'API Anthropic e salva un riassunto strutturato. Visualizzalo nella schermata della lezione. Applica la coda paziente della **sezione 5.6** se manca la connessione.

**Tappa 6 — Studio: tocca-per-riascoltare**
Implementa la funzione della **sezione 7.4**: toccando una frase della trascrizione, l'audio parte dal timestamp corrispondente. Mostra anche i bookmark salvati durante la registrazione come marcatori navigabili.

**Tappa 7 — Download, offline ed esportazione**
Implementa: (a) download del file audio originale di una lezione tramite link temporaneo dal backend; (b) **download audio per l'offline** su richiesta per singola lezione (stato `offlineAudioState`, con possibilità di rimuovere il download — sezione 5.6); (c) **export della trascrizione grezza Scribe** (versioni verbatim e pulita in .txt, più JSON opzionale) come voce distinta e indipendente dal riassunto, sempre disponibile; (d) export del testo elaborato (trascrizione + riassunto) in .txt e PDF; (e) "Esporta tutto" per scaricare in blocco tutte le lezioni come backup (via di fuga della sezione 5.4).

**Tappa 8 — Rifiniture UX**
Aggiungi l'indicatore di utilizzo/costo stimato della **sezione 7.5** e qualsiasi altra rifinitura UX rimasta. Verifica che tutti gli stati e i feedback delle sezioni 7.1 e 7.5 siano coerenti in tutta l'app.

**Tappa 9 — Autenticazione**
Introduci un sistema di login (vedi stack, sezione 9) e associa le lezioni all'utente (`userId` nello schema). Aggiorna le API perché restituiscano solo i dati dell'utente autenticato. Integra il login nel client mobile. Nota: l'autenticazione è un prerequisito del client web; se preferisci, può essere anticipata, ma va comunque introdotta prima della Tappa 10.

**Tappa 10 — Client web companion (Mac/PC)**
Costruisci il frontend web nello **stesso progetto Next.js** del backend (sezione 2): pagine per login, archivio/ricerca, dettaglio lezione (trascrizione con le tre versioni, riassunto, riascolto audio), modifica testo, export, **import via drag-and-drop** di file audio/video dal computer, e **registrazione** da microfono e audio del computer secondo la **sezione 4-ter** (con graceful degradation e avvisi sui limiti di cattura audio di sistema). Riusa le stesse API del client mobile (backend agnostico rispetto al client). Cura il layout per schermo grande (non limitarti a scalare la UI mobile).

---

## 13. Istruzioni di lavoro per Claude Code

- Procedi **una tappa alla volta**. Al termine di ciascuna, fermati, spiega cosa hai creato, come testarlo sull'iPhone, e attendi conferma prima di proseguire.
- **La resilienza (sezione 5) non è una tappa separata: è un principio trasversale.** Applica i requisiti di gestione dei failure pertinenti in ogni tappa, man mano che costruisci la funzione corrispondente, non rimandarli alla fine.
- **L'esperienza utente (sezione 7) va curata in ogni tappa**, non solo nella Tappa 8: feedback chiari, stati visibili e nessun momento di incertezza per l'utente.
- **Usa il mockup allegato (`mockup-app-lezioni-ios.jsx`) come riferimento visivo** (sezione 8): traduci l'estetica e i flussi in React Native, non copiare il codice web. Rispetta la palette neutra e lo stile Apple descritti.
- Prima di usare API esterne (ElevenLabs, Anthropic) o moduli Expo di cui non sei certo della versione/sintassi attuale, **verifica la documentazione corrente** invece di assumere.
- Spiega ogni scelta architetturale non ovvia.
- Tutte le chiavi segrete vanno gestite via variabili d'ambiente; predisponi un file `.env.example` documentato.
- Scrivi codice chiaro e commentato dove serve: ho esperienza base, devo poter seguire cosa fa.
- Segnalami esplicitamente ogni passo che devo fare io manualmente (creare account, ottenere chiavi, configurare servizi su Railway, dare permessi su iPhone).
