#!/usr/bin/env node

const API = process.env.API || 'http://localhost:3000/api';
const PW = 'Test1234!';

const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');

async function request(method, endpoint, token, bodyOrForm, isJson = true) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let options = { method, headers };

    if (bodyOrForm) {
        if (isJson) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(bodyOrForm);
        } else {
            options.body = bodyOrForm;
        }
    }

    const res = await fetch(`${API}${endpoint}`, options);
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }
    return { status: res.status, data };
}

async function login(email) {
    const res = await request('POST', '/auth/login', null, { email, password: PW });
    return res.data.token;
}

function step(title) {
    console.log(`\n== ${title}`);
}

async function run() {
    try {
        step("Authentification des différents rôles");
        const AMEL = await login('amel.sassi@example.com');
        const YOUSSEF = await login('youssef.ayari@example.com');
        const ORG = await login('contact.citoyen@commune-tunis.gov.tn');
        const LEAD = await login('r.jaziri@commune-tunis.gov.tn');
        const ADM = await login('ahmed.hajsaid@supcom.tn');

        step("Admin : délai de contestation = 1 minute (démo)");
        let res = await request('PUT', '/admin/settings/contest_delay_minutes', ADM, { value: 1 });
        console.log(`HTTP ${res.status}`, res.data);

        step("Amel déclare un lampadaire (catégorie 4) + photo");
        res = await request('POST', '/reports', AMEL, {
            title: "Lampadaire éteint école",
            description: "Eteint depuis 3 nuits",
            category_id: 4,
            latitude: 36.8065,
            longitude: 10.1815
        });
        const RID = res.data.id;
        console.log(`report id = ${RID}`);

        const form = new FormData();
        form.append('photos', new Blob([pngBuffer], { type: 'image/png' }), 'madinty.png');
        res = await request('POST', `/reports/${RID}/images`, AMEL, form, false);
        console.log(`Upload image valide: HTTP ${res.status}`);

        const fakeForm = new FormData();
        fakeForm.append('photos', new Blob(['pas une image'], { type: 'image/png' }), 'fake.png');
        res = await request('POST', `/reports/${RID}/images`, AMEL, fakeForm, false);
        console.log(`faux fichier .png (400 attendu) -> HTTP ${res.status}`);

        step("Youssef cherche des doublons à proximité, puis soutient");
        res = await request('GET', '/reports/nearby?latitude=36.8066&longitude=10.1816&category_id=4', YOUSSEF);
        console.log(`Nearby status: ${res.status}`);

        res = await request('POST', `/reports/${RID}/support`, YOUSSEF, {});
        console.log(`Premier soutien -> HTTP ${res.status}`);

        res = await request('POST', `/reports/${RID}/support`, YOUSSEF, {});
        console.log(`Deuxième soutien (conflit attendu) -> HTTP ${res.status}`);

        step("Organisme : liste, accepte, fixe la priorité");
        res = await request('GET', '/organisme/reports?status=Soumis', ORG);
        console.log(`Liste organisme status: ${res.status}`);

        res = await request('POST', `/organisme/reports/${RID}/decision`, ORG, { action: 'accept' });
        console.log(`Acceptation -> HTTP ${res.status}`);

        res = await request('POST', `/organisme/reports/${RID}/priority`, ORG, { priority: 'Haute', justification: 'Sortie ecole' });
        console.log(`Priorité fixée -> HTTP ${res.status}`);

        step("Organisme : créer + affecter l'intervention");
        const teamsRes = await request('GET', '/organisme/teams', ORG);
        const team = teamsRes.data.find(t => t.name === 'Équipe éclairage');
        const TEAM = team ? team.id : null;

        res = await request('POST', '/organisme/interventions', ORG, {
            report_id: RID,
            team_id: TEAM,
            priority: 'Haute',
            instructions: 'Verifier l alimentation'
        });
        const IID = res.data.id;
        console.log(`intervention id = ${IID}`);

        step("Terrain : démarre, photos avant/après, compte rendu, soumission");
        res = await request('GET', '/equipe/interventions?state=a_faire', LEAD);
        console.log(`Missions terrain status: ${res.status}`);

        res = await request('POST', `/equipe/interventions/${IID}/progress`, LEAD, { status: 'En cours' });
        console.log(`Passage en cours -> HTTP ${res.status}`);

        const formAvant = new FormData();
        formAvant.append('kind', 'Avant');
        formAvant.append('photos', new Blob([pngBuffer], { type: 'image/png' }), 'madinty.png');
        await request('POST', `/equipe/interventions/${IID}/images`, LEAD, formAvant, false);

        const formApres = new FormData();
        formApres.append('kind', 'Après');
        formApres.append('photos', new Blob([pngBuffer], { type: 'image/png' }), 'madinty.png');
        await request('POST', `/equipe/interventions/${IID}/images`, LEAD, formApres, false);

        res = await request('POST', `/equipe/interventions/${IID}/submit`, LEAD, {});
        console.log(`Soumission sans compte rendu (400 attendu) -> HTTP ${res.status}`);

        res = await request('POST', `/equipe/interventions/${IID}/submit`, LEAD, { work_report: 'Ampoule et ballast remplacés.' });
        console.log(`Soumission valide -> HTTP ${res.status}`);

        const VOIRIE = await login('s.benamor@commune-tunis.gov.tn');
        res = await request('GET', `/equipe/interventions/${IID}`, VOIRIE);
        console.log(`L'équipe de voirie accède à la mission (404 attendu) -> HTTP ${res.status}`);

        step("Organisme valide -> Résolu");
        res = await request('POST', `/organisme/interventions/${IID}/validate`, ORG, { approve: true });
        console.log(`Validation organisme -> HTTP ${res.status}`);

        step("Amel voit le dossier + historique, puis confirme « C'est réglé »");
        res = await request('GET', `/reports/${RID}`, AMEL);
        console.log(`Dossier vu par Amel -> HTTP ${res.status}`);

        res = await request('POST', `/reports/${RID}/confirm`, AMEL, {});
        console.log(`Confirmation 'C'est réglé' -> HTTP ${res.status}`);

        res = await request('POST', `/reports/${RID}/contest`, AMEL, { message: 'test' });
        console.log(`Contestation après clôture (409 attendu) -> HTTP ${res.status}`);

        step("Notifications, indicateurs, stats publiques, page organisme");
        res = await request('GET', '/notifications', AMEL);
        console.log(`Notifications status: ${res.status}`);

        res = await request('GET', '/organisme/indicators', ORG);
        console.log(`Indicateurs status: ${res.status}`);

        res = await request('GET', '/public/stats', null);
        console.log(`Stats publiques status: ${res.status}`);

        res = await request('GET', '/public/organizations/municipalite-tunis', null);
        console.log(`Page organisme publique status: ${res.status}`);

        step("Admin : journal d'audit");
        res = await request('GET', '/admin/audit-logs?limit=5', ADM);
        console.log(`Logs d'audit status: ${res.status}`);

        console.log("\n✅ Workflow de test exécuté avec succès en JavaScript !");
    } catch (error) {
        console.error("❌ Erreur durant l'exécution du workflow :", error);
    }
}

run();
