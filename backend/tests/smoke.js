#!/usr/bin/env node

const API = process.env.API || 'http://localhost:3000/api';
const PW = 'Test1234!';
const j = async (res) => {
    const data = await res.json();
    return data;
};

async function run() {
    console.log("1) health (API + base)");
    let res = await fetch(`${API}/health`);
    console.log(await res.text());

    console.log("2) catégories");
    res = await fetch(`${API}/categories`);
    const textCat = await res.text();
    console.log(textCat.substring(0, 300));

    console.log("3) login citoyen");
    res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'amel.sassi@example.com', password: PW })
    });
    const authData = await res.json();
    const TOKEN = authData.token;
    console.log(`   token: ${TOKEN ? TOKEN.substring(0, 25) + '...' : 'undefined'}`);

    console.log("4) mauvais mot de passe (401 attendu)");
    res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'amel.sassi@example.com', password: 'faux' })
    });
    console.log(`   HTTP ${res.status}`);

    console.log("5) créer un signalement (201 attendu)");
    res = await fetch(`${API}/reports`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: "Lampadaire éteint",
            description: "Éteint depuis trois nuits",
            category_id: 4,
            latitude: 36.8065,
            longitude: 10.1815,
            address: "Av. de la Liberté"
        })
    });
    console.log(await res.text());

    console.log("6) sans description (400 attendu)");
    res = await fetch(`${API}/reports`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: "Test", category_id: 4, latitude: 36.8, longitude: 10.1 })
    });
    console.log(`   HTTP ${res.status}`);

    console.log("7) sans token (401 attendu)");
    res = await fetch(`${API}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    console.log(`   HTTP ${res.status}`);

    console.log("8) liste publique, sans user_id");
    res = await fetch(`${API}/reports?category_id=4`);
    const textRep = await res.text();
    console.log(textRep.substring(0, 400));

    console.log("9) détail par référence");
    res = await fetch(`${API}/reports/MD-0001`);
    const textRef = await res.text();
    console.log(textRef.substring(0, 400));

    console.log("10) rôle Organisme refusé pour POST (403 attendu)");
    res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'contact.citoyen@commune-tunis.gov.tn', password: PW })
    });
    const orgAuth = await res.json();
    const OTOKEN = orgAuth.token;

    res = await fetch(`${API}/reports`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OTOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    });
    console.log(`   HTTP ${res.status}`);
}

run();
