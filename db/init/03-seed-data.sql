INSERT INTO "ORGANIZATIONS" (name, slug, type, description, public_email, public_phone, opening_hours) VALUES
('Municipalité de Tunis', 'municipalite-tunis', 'Gouvernemental', 'Gestion de la voirie, propreté, éclairage public et espaces verts de la ville de Tunis', 'contact@commune-tunis.gov.tn', '71 123 456', 'Lun-Ven: 08h00-14h00'),
('SONEDE', 'sonede', 'Entreprise Publique', 'Société Nationale d''Exploitation et de Distribution des Eaux', 'contact@sonede.com.tn', '71 234 567', 'Lun-Ven: 08h00-15h00'),
('ONAS', 'onas', 'Entreprise Publique', 'Office National de l''Assainissement', 'boc@onas.nat.tn', '71 345 678', 'Lun-Ven: 08h00-15h00'),
('STEG', 'steg', 'Entreprise Publique', 'Société Tunisienne de l''Électricité et du Gaz', 'dpsc@steg.com.tn', '71 456 789', 'Lun-Ven: 08h00-15h00');

INSERT INTO "CATEGORIES" (organization_id, label, description, severity_weight, risk_weight, icon_key) VALUES
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), 'Déchets et propreté', 'Amas de déchets, poubelles pleines, décharges sauvages', 3.0, 2.0, 'proprete'),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), 'Voirie et trottoirs', 'Nids de poule, trottoirs endommagés, obstacles', 4.0, 3.5, 'voirie'),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), 'Espaces verts', 'Arbres non taillés, parcs dégradés', 2.0, 1.0, 'mobilier'),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), 'Éclairage public', 'Lampadaire en panne, rue dans le noir', 3.5, 3.0, 'eclairage'),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), 'Mobilier urbain', 'Bancs cassés, abribus, panneaux et poubelles de rue endommagés', 2.0, 1.5, 'mobilier'),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), 'Autres', 'Tout problème urbain ne correspondant à aucune autre catégorie', 2.0, 2.0, 'autre'),

((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'sonede'), 'Fuite d''eau potable', 'Canalisation percée, fuite sur le réseau public', 5.0, 4.0, 'eau'),

((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'onas'), 'Débordement d''égouts', 'Bouche d''égout bouchée, eaux usées sur la chaussée', 4.5, 4.5, 'eau'),

((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'steg'), 'Danger électrique', 'Câbles exposés, poteau endommagé', 5.0, 5.0, 'eclairage');

INSERT INTO "USERS" (full_name, email, password_hash, role, state, privacy_accepted_at) VALUES
('Haj Said Ahmed', 'ahmed.hajsaid@supcom.tn', '$2b$10$LJUn1vyehK/phmLvg9xlUuj6nZWhtY5LCcNPXE5osBtYHyqXQ5hVa', 'Administrateur', 'Actif', CURRENT_TIMESTAMP),
('Laouini Rawand', 'rawand.laouini@supcom.tn', '$2b$10$LJUn1vyehK/phmLvg9xlUuj6nZWhtY5LCcNPXE5osBtYHyqXQ5hVa', 'Administrateur', 'Actif', CURRENT_TIMESTAMP);

INSERT INTO "USERS" (full_name, email, password_hash, role, state, privacy_accepted_at) VALUES
('Amel Sassi', 'amel.sassi@example.com', '$2b$10$LJUn1vyehK/phmLvg9xlUuj6nZWhtY5LCcNPXE5osBtYHyqXQ5hVa', 'Citoyen', 'Actif', CURRENT_TIMESTAMP),
('Youssef Ayari', 'youssef.ayari@example.com', '$2b$10$LJUn1vyehK/phmLvg9xlUuj6nZWhtY5LCcNPXE5osBtYHyqXQ5hVa', 'Citoyen', 'Actif', CURRENT_TIMESTAMP),
('Ines Mansour', 'ines.mansour@example.com', '$2b$10$LJUn1vyehK/phmLvg9xlUuj6nZWhtY5LCcNPXE5osBtYHyqXQ5hVa', 'Citoyen', 'Actif', CURRENT_TIMESTAMP);

INSERT INTO "USERS" (organization_id, full_name, email, password_hash, role, state, privacy_accepted_at) VALUES
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), 'Service Plainte Municipalité', 'contact.citoyen@commune-tunis.gov.tn', '$2b$10$LJUn1vyehK/phmLvg9xlUuj6nZWhtY5LCcNPXE5osBtYHyqXQ5hVa', 'Organisme', 'Actif', CURRENT_TIMESTAMP),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'sonede'), 'Support SONEDE', 'support@sonede.com.tn', '$2b$10$LJUn1vyehK/phmLvg9xlUuj6nZWhtY5LCcNPXE5osBtYHyqXQ5hVa', 'Organisme', 'Actif', CURRENT_TIMESTAMP);

INSERT INTO "USERS" (organization_id, full_name, email, password_hash, role, state, privacy_accepted_at) VALUES
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), 'Sami Ben Amor', 's.benamor@commune-tunis.gov.tn', '$2b$10$LJUn1vyehK/phmLvg9xlUuj6nZWhtY5LCcNPXE5osBtYHyqXQ5hVa', 'Responsable d''équipe', 'Actif', CURRENT_TIMESTAMP),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), 'Rym Jaziri', 'r.jaziri@commune-tunis.gov.tn', '$2b$10$LJUn1vyehK/phmLvg9xlUuj6nZWhtY5LCcNPXE5osBtYHyqXQ5hVa', 'Responsable d''équipe', 'Actif', CURRENT_TIMESTAMP),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'sonede'), 'Mohamed Gharbi', 'm.gharbi@sonede.com.tn', '$2b$10$LJUn1vyehK/phmLvg9xlUuj6nZWhtY5LCcNPXE5osBtYHyqXQ5hVa', 'Responsable d''équipe', 'Actif', CURRENT_TIMESTAMP);

INSERT INTO "TEAMS" (organization_id, lead_id, name, domain, members_count) VALUES
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), (SELECT id FROM "USERS" WHERE email = 'r.jaziri@commune-tunis.gov.tn'),  'Équipe éclairage',     'Éclairage public', 4),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), (SELECT id FROM "USERS" WHERE email = 's.benamor@commune-tunis.gov.tn'), 'Équipe voirie',        'Voirie et trottoirs', 6),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), NULL, 'Équipe propreté',      'Déchets et propreté', 5),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'municipalite-tunis'), NULL, 'Équipe espaces verts', 'Espaces verts', 3),
((SELECT id FROM "ORGANIZATIONS" WHERE slug = 'sonede'),             (SELECT id FROM "USERS" WHERE email = 'm.gharbi@sonede.com.tn'),        'Équipe réseaux',       'Fuite d''eau potable', 4);

INSERT INTO "SETTINGS" (key, value, updated_by) VALUES
('contest_delay_minutes', '10080', (SELECT id FROM "USERS" WHERE email = 'ahmed.hajsaid@supcom.tn'));

INSERT INTO "REPORTS" (id, reference, user_id, category_id, title, description, address, latitude, longitude,
                       status, priority, priority_set_by, resolution_round, resolved_at, closed_at, contest_deadline, created_at)
SELECT v.id, 'MD-' || lpad(v.id::text, 4, '0'), u.id, c.id, v.title, v.description, v.address, v.lat, v.lng,
       v.status::report_status_enum, v.priority::priority_enum, o.id,
       CASE WHEN v.resolved_h IS NULL THEN 0 ELSE 1 END,
       now() - v.resolved_h * interval '1 hour',
       now() - v.closed_h * interval '1 hour',
       CASE WHEN v.status = 'Résolu' THEN now() - v.resolved_h * interval '1 hour'
            + (SELECT value::int FROM "SETTINGS" WHERE key = 'contest_delay_minutes') * interval '1 minute' END,
       now() - v.created_h * interval '1 hour'
  FROM (VALUES
    (1, 'Lampadaire éteint devant l’école', 'Le lampadaire devant l’entrée de l’école est éteint depuis plusieurs jours : les enfants sortent dans le noir.', 'Av. de la Liberté', 'Éclairage public', 36.8128, 10.1796, 'En cours', 'Haute', 'amel.sassi@example.com', 'contact.citoyen@commune-tunis.gov.tn', 150, NULL, NULL),
    (2, 'Nid-de-poule profond', 'Nid-de-poule d’une vingtaine de centimètres au milieu de la chaussée, dangereux pour les deux-roues.', 'Av. de la Liberté', 'Voirie et trottoirs', 36.8104, 10.1768, 'Accepté', 'Moyenne', 'youssef.ayari@example.com', 'contact.citoyen@commune-tunis.gov.tn', 30, NULL, NULL),
    (3, 'Dépôt sauvage', 'Gravats et sacs poubelles déposés le long du mur, l’amas grossit chaque jour.', 'Rue Ibn Khaldoun', 'Déchets et propreté', 36.8061, 10.1842, 'Soumis', NULL, 'ines.mansour@example.com', NULL, 5, NULL, NULL),
    (4, 'Fuite d’eau importante', 'Une canalisation fuit et l’eau coule en continu sur la chaussée depuis ce matin.', 'Cité El Khadra', 'Fuite d''eau potable', 36.8362, 10.1496, 'En cours', 'Critique', 'youssef.ayari@example.com', 'support@sonede.com.tn', 60, NULL, NULL),
    (5, 'Trottoir dégradé', 'Dalles du trottoir soulevées : risque de chute, surtout pour les poussettes et les personnes âgées.', 'Place Pasteur', 'Voirie et trottoirs', 36.8226, 10.1789, 'Résolu', 'Moyenne', 'ines.mansour@example.com', 'contact.citoyen@commune-tunis.gov.tn', 200, 96, NULL),
    (6, 'Banc cassé', 'Deux lattes du banc sont brisées, assise inutilisable.', 'Parc du Belvédère', 'Mobilier urbain', 36.8236, 10.1721, 'Soumis', NULL, 'amel.sassi@example.com', NULL, 28, NULL, NULL),
    (7, 'Lampadaire clignotant', 'Le lampadaire clignote toute la soirée puis s’éteint complètement.', 'Av. de la Liberté', 'Éclairage public', 36.8139, 10.1812, 'En vérification', NULL, 'ines.mansour@example.com', NULL, 48, NULL, NULL),
    (8, 'Éclairage défaillant', 'Trois lampadaires consécutifs ne fonctionnent plus, la rue est plongée dans le noir.', 'Rue de Marseille', 'Éclairage public', 36.8002, 10.1855, 'En cours', 'Moyenne', 'youssef.ayari@example.com', 'contact.citoyen@commune-tunis.gov.tn', 144, NULL, NULL),
    (9, 'Nid-de-poule', 'Plusieurs nids-de-poule se forment à l’entrée de la rue, la chaussée se désagrège.', 'Rue de Marseille', 'Voirie et trottoirs', 36.7995, 10.1827, 'En cours', 'Moyenne', 'amel.sassi@example.com', 'contact.citoyen@commune-tunis.gov.tn', 120, NULL, NULL),
    (10, 'Poubelle renversée', 'Le bac à ordures est renversé et son contenu s’étale sur le trottoir.', 'Av. Habib Bourguiba', 'Déchets et propreté', 36.7996, 10.1809, 'Clos', 'Basse', 'ines.mansour@example.com', 'contact.citoyen@commune-tunis.gov.tn', 300, 260, 230),
    (11, 'Dépôt sauvage', 'Décharge sauvage dans le terrain vague à côté de l’arrêt de bus.', 'Cité Ennasr', 'Déchets et propreté', 36.8601, 10.1612, 'Accepté', 'Basse', 'amel.sassi@example.com', 'contact.citoyen@commune-tunis.gov.tn', 90, NULL, NULL),
    (12, 'Égout qui déborde', 'Une bouche d’égout est bouchée : des eaux usées coulent sur la chaussée et sentent très fort.', 'Rue Ibn Khaldoun', 'Débordement d''égouts', 36.8073, 10.1787, 'Soumis', NULL, 'youssef.ayari@example.com', NULL, 52, NULL, NULL),
    (13, 'Lampadaire éteint', 'Le lampadaire de l’angle ne s’allume plus depuis une semaine.', 'Place Pasteur', 'Éclairage public', 36.8219, 10.1803, 'Clos', 'Moyenne', 'amel.sassi@example.com', 'contact.citoyen@commune-tunis.gov.tn', 400, 230, 200),
    (14, 'Banc cassé', 'Le banc est arraché de son support et couché sur l’herbe.', 'Av. Habib Thameur', 'Mobilier urbain', 36.7983, 10.1872, 'En vérification', NULL, 'youssef.ayari@example.com', NULL, 20, NULL, NULL),
    (15, 'Trottoir effondré', 'Un morceau de trottoir s’est effondré, un trou d’environ un mètre est apparu devant un commerce.', 'Av. Habib Thameur', 'Voirie et trottoirs', 36.8008, 10.1881, 'Accepté', 'Haute', 'ines.mansour@example.com', 'contact.citoyen@commune-tunis.gov.tn', 40, NULL, NULL),
    (16, 'Câble électrique pendant', 'Un câble électrique pend d’un poteau à hauteur d’homme, au-dessus du trottoir.', 'Cité El Khadra', 'Danger électrique', 36.8349, 10.1521, 'Soumis', NULL, 'amel.sassi@example.com', NULL, 12, NULL, NULL)
  ) AS v(id, title, description, address, cat_label, lat, lng, status, priority, author_email, org_email, created_h, resolved_h, closed_h)
  JOIN "USERS" u ON u.email = v.author_email
  JOIN "CATEGORIES" c ON c.label = v.cat_label
  LEFT JOIN "USERS" o ON o.email = v.org_email;

SELECT setval(pg_get_serial_sequence('"REPORTS"', 'id'), (SELECT MAX(id) FROM "REPORTS"));

INSERT INTO "REPORT_STATUS_HISTORY" (report_id, author_id, old_status, new_status, comment, created_at)
SELECT v.report_id, u.id, v.old_status::report_status_enum, v.new_status::report_status_enum, v.comment, now() - v.h * interval '1 hour'
  FROM (VALUES
    (1, 'amel.sassi@example.com', NULL, 'Soumis', 'Signalement créé', 150),
    (1, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 149),
    (1, 'contact.citoyen@commune-tunis.gov.tn', 'En vérification', 'Accepté', 'Signalement accepté', 147),
    (1, 'contact.citoyen@commune-tunis.gov.tn', 'Accepté', 'Affecté', 'Intervention affectée à une équipe', 145),
    (1, 'contact.citoyen@commune-tunis.gov.tn', 'Affecté', 'En cours', 'Intervention démarrée sur place', 126),
    (2, 'youssef.ayari@example.com', NULL, 'Soumis', 'Signalement créé', 30),
    (2, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 29),
    (2, 'contact.citoyen@commune-tunis.gov.tn', 'En vérification', 'Accepté', 'Signalement accepté', 27),
    (3, 'ines.mansour@example.com', NULL, 'Soumis', 'Signalement créé', 5),
    (4, 'youssef.ayari@example.com', NULL, 'Soumis', 'Signalement créé', 60),
    (4, 'support@sonede.com.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 59),
    (4, 'support@sonede.com.tn', 'En vérification', 'Accepté', 'Signalement accepté', 57),
    (4, 'support@sonede.com.tn', 'Accepté', 'Affecté', 'Intervention affectée à une équipe', 55),
    (4, 'support@sonede.com.tn', 'Affecté', 'En cours', 'Intervention démarrée sur place', 36),
    (5, 'ines.mansour@example.com', NULL, 'Soumis', 'Signalement créé', 200),
    (5, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 199),
    (5, 'contact.citoyen@commune-tunis.gov.tn', 'En vérification', 'Accepté', 'Signalement accepté', 197),
    (5, 'contact.citoyen@commune-tunis.gov.tn', 'Accepté', 'Affecté', 'Intervention affectée à une équipe', 195),
    (5, 'contact.citoyen@commune-tunis.gov.tn', 'Affecté', 'En cours', 'Intervention démarrée sur place', 176),
    (5, 'contact.citoyen@commune-tunis.gov.tn', 'En cours', 'Résolu', 'Intervention terminée, compte rendu validé', 96),
    (6, 'amel.sassi@example.com', NULL, 'Soumis', 'Signalement créé', 28),
    (7, 'ines.mansour@example.com', NULL, 'Soumis', 'Signalement créé', 48),
    (7, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 47),
    (8, 'youssef.ayari@example.com', NULL, 'Soumis', 'Signalement créé', 144),
    (8, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 143),
    (8, 'contact.citoyen@commune-tunis.gov.tn', 'En vérification', 'Accepté', 'Signalement accepté', 141),
    (8, 'contact.citoyen@commune-tunis.gov.tn', 'Accepté', 'Affecté', 'Intervention affectée à une équipe', 139),
    (8, 'contact.citoyen@commune-tunis.gov.tn', 'Affecté', 'En cours', 'Intervention démarrée sur place', 120),
    (9, 'amel.sassi@example.com', NULL, 'Soumis', 'Signalement créé', 120),
    (9, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 119),
    (9, 'contact.citoyen@commune-tunis.gov.tn', 'En vérification', 'Accepté', 'Signalement accepté', 117),
    (9, 'contact.citoyen@commune-tunis.gov.tn', 'Accepté', 'Affecté', 'Intervention affectée à une équipe', 115),
    (9, 'contact.citoyen@commune-tunis.gov.tn', 'Affecté', 'En cours', 'Intervention démarrée sur place', 96),
    (10, 'ines.mansour@example.com', NULL, 'Soumis', 'Signalement créé', 300),
    (10, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 299),
    (10, 'contact.citoyen@commune-tunis.gov.tn', 'En vérification', 'Accepté', 'Signalement accepté', 297),
    (10, 'contact.citoyen@commune-tunis.gov.tn', 'Accepté', 'Affecté', 'Intervention affectée à une équipe', 295),
    (10, 'contact.citoyen@commune-tunis.gov.tn', 'Affecté', 'En cours', 'Intervention démarrée sur place', 276),
    (10, 'contact.citoyen@commune-tunis.gov.tn', 'En cours', 'Résolu', 'Intervention terminée, compte rendu validé', 260),
    (10, 'ines.mansour@example.com', 'Résolu', 'Clos', 'Résolution confirmée', 230),
    (11, 'amel.sassi@example.com', NULL, 'Soumis', 'Signalement créé', 90),
    (11, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 89),
    (11, 'contact.citoyen@commune-tunis.gov.tn', 'En vérification', 'Accepté', 'Signalement accepté', 87),
    (12, 'youssef.ayari@example.com', NULL, 'Soumis', 'Signalement créé', 52),
    (13, 'amel.sassi@example.com', NULL, 'Soumis', 'Signalement créé', 400),
    (13, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 399),
    (13, 'contact.citoyen@commune-tunis.gov.tn', 'En vérification', 'Accepté', 'Signalement accepté', 397),
    (13, 'contact.citoyen@commune-tunis.gov.tn', 'Accepté', 'Affecté', 'Intervention affectée à une équipe', 395),
    (13, 'contact.citoyen@commune-tunis.gov.tn', 'Affecté', 'En cours', 'Intervention démarrée sur place', 376),
    (13, 'contact.citoyen@commune-tunis.gov.tn', 'En cours', 'Résolu', 'Intervention terminée, compte rendu validé', 230),
    (13, 'amel.sassi@example.com', 'Résolu', 'Clos', 'Résolution confirmée', 200),
    (14, 'youssef.ayari@example.com', NULL, 'Soumis', 'Signalement créé', 20),
    (14, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 19),
    (15, 'ines.mansour@example.com', NULL, 'Soumis', 'Signalement créé', 40),
    (15, 'contact.citoyen@commune-tunis.gov.tn', 'Soumis', 'En vérification', 'Dossier pris en charge pour vérification', 39),
    (15, 'contact.citoyen@commune-tunis.gov.tn', 'En vérification', 'Accepté', 'Signalement accepté', 37),
    (16, 'amel.sassi@example.com', NULL, 'Soumis', 'Signalement créé', 12)
  ) AS v(report_id, who, old_status, new_status, comment, h)
  JOIN "USERS" u ON u.email = v.who;

INSERT INTO "SUPPORTS" (report_id, user_id, created_at)
SELECT v.report_id, u.id, now() - v.h * interval '1 hour'
  FROM (VALUES
    (1, 'youssef.ayari@example.com', 148),
    (1, 'ines.mansour@example.com', 145),
    (2, 'amel.sassi@example.com', 28),
    (2, 'ines.mansour@example.com', 25),
    (3, 'amel.sassi@example.com', 3),
    (4, 'amel.sassi@example.com', 58),
    (4, 'ines.mansour@example.com', 55),
    (5, 'amel.sassi@example.com', 198),
    (6, 'youssef.ayari@example.com', 26),
    (8, 'amel.sassi@example.com', 142),
    (8, 'ines.mansour@example.com', 139),
    (9, 'youssef.ayari@example.com', 118),
    (9, 'ines.mansour@example.com', 115),
    (11, 'ines.mansour@example.com', 88),
    (12, 'ines.mansour@example.com', 50),
    (15, 'amel.sassi@example.com', 38),
    (15, 'youssef.ayari@example.com', 35),
    (16, 'youssef.ayari@example.com', 10)
  ) AS v(report_id, who, h)
  JOIN "USERS" u ON u.email = v.who;

INSERT INTO "INTERVENTIONS" (id, reference, report_id, organization_id, team_id, lead_id, created_by, priority, planned_date,
                             instructions, status, work_report, submitted_at, validated_at, validated_by)
SELECT v.id, v.reference, v.report_id, c.organization_id, t.id, l.id, o.id, v.priority::priority_enum, v.planned,
       v.instructions, v.status::intervention_status_enum, v.work_report, v.submitted_at, v.validated_at,
       CASE WHEN v.validated_at IS NOT NULL THEN o.id END
  FROM (VALUES
    (1, 'INT-0001', 1, 'Équipe éclairage', 'r.jaziri@commune-tunis.gov.tn', 'contact.citoyen@commune-tunis.gov.tn', 'Haute', CURRENT_DATE + 2, 'Intervention liée à MD-0001.', 'En cours', NULL, NULL, NULL),
    (2, 'INT-0002', 4, 'Équipe réseaux', 'm.gharbi@sonede.com.tn', 'support@sonede.com.tn', 'Critique', CURRENT_DATE + 2, 'Intervention liée à MD-0004.', 'En cours', NULL, NULL, NULL),
    (3, 'INT-0003', 8, 'Équipe éclairage', 'r.jaziri@commune-tunis.gov.tn', 'contact.citoyen@commune-tunis.gov.tn', 'Moyenne', CURRENT_DATE + 2, 'Intervention liée à MD-0008.', 'En cours', NULL, NULL, NULL),
    (4, 'INT-0004', 9, 'Équipe voirie', 's.benamor@commune-tunis.gov.tn', 'contact.citoyen@commune-tunis.gov.tn', 'Moyenne', CURRENT_DATE + 2, 'Intervention liée à MD-0009.', 'En cours', NULL, NULL, NULL),
    (5, 'INT-0005', 5, 'Équipe voirie', 's.benamor@commune-tunis.gov.tn', 'contact.citoyen@commune-tunis.gov.tn', 'Moyenne', CURRENT_DATE - 5, 'Intervention liée à MD-0005.', 'Terminée', 'Dalles remplacées et scellées sur 6 m². Zone nettoyée.', now() - 98 * interval '1 hour', now() - 96 * interval '1 hour'),
    (6, 'INT-0006', 10, 'Équipe propreté', NULL, 'contact.citoyen@commune-tunis.gov.tn', 'Basse', CURRENT_DATE - 5, 'Intervention liée à MD-0010.', 'Terminée', 'Bac redressé, déchets ramassés et trottoir nettoyé.', now() - 262 * interval '1 hour', now() - 260 * interval '1 hour'),
    (7, 'INT-0007', 13, 'Équipe éclairage', 'r.jaziri@commune-tunis.gov.tn', 'contact.citoyen@commune-tunis.gov.tn', 'Moyenne', CURRENT_DATE - 5, 'Intervention liée à MD-0013.', 'Terminée', 'Ampoule et ballast remplacés. Fonctionnement vérifié à la tombée de la nuit.', now() - 232 * interval '1 hour', now() - 230 * interval '1 hour')
  ) AS v(id, reference, report_id, team_name, lead_email, org_email, priority, planned, instructions, status, work_report, submitted_at, validated_at)
  JOIN "REPORTS" r ON r.id = v.report_id
  JOIN "CATEGORIES" c ON c.id = r.category_id
  JOIN "TEAMS" t ON t.name = v.team_name AND t.organization_id = c.organization_id
  LEFT JOIN "USERS" l ON l.email = v.lead_email
  JOIN "USERS" o ON o.email = v.org_email;
SELECT setval(pg_get_serial_sequence('"INTERVENTIONS"', 'id'), (SELECT MAX(id) FROM "INTERVENTIONS"));

INSERT INTO "INTERVENTION_HISTORY" (intervention_id, author_id, old_status, new_status, comment, created_at)
SELECT v.intervention_id, u.id, v.old_status::intervention_status_enum, v.new_status::intervention_status_enum, v.comment, now() - v.h * interval '1 hour'
  FROM (VALUES
    (1, 'contact.citoyen@commune-tunis.gov.tn', 'À affecter', 'Affectée', 'Équipe affectée', 145),
    (1, 'r.jaziri@commune-tunis.gov.tn', 'Affectée', 'En cours', 'Intervention démarrée sur place', 126),
    (2, 'support@sonede.com.tn', 'À affecter', 'Affectée', 'Équipe affectée', 55),
    (2, 'm.gharbi@sonede.com.tn', 'Affectée', 'En cours', 'Intervention démarrée sur place', 36),
    (3, 'contact.citoyen@commune-tunis.gov.tn', 'À affecter', 'Affectée', 'Équipe affectée', 139),
    (3, 'r.jaziri@commune-tunis.gov.tn', 'Affectée', 'En cours', 'Intervention démarrée sur place', 120),
    (4, 'contact.citoyen@commune-tunis.gov.tn', 'À affecter', 'Affectée', 'Équipe affectée', 115),
    (4, 's.benamor@commune-tunis.gov.tn', 'Affectée', 'En cours', 'Intervention démarrée sur place', 96),
    (5, 'contact.citoyen@commune-tunis.gov.tn', 'À affecter', 'Affectée', 'Équipe affectée', 195),
    (5, 's.benamor@commune-tunis.gov.tn', 'Affectée', 'En cours', 'Intervention démarrée sur place', 176),
    (5, 's.benamor@commune-tunis.gov.tn', 'En cours', 'À valider', 'Compte rendu soumis', 98),
    (5, 'contact.citoyen@commune-tunis.gov.tn', 'À valider', 'Terminée', 'Compte rendu validé', 96),
    (6, 'contact.citoyen@commune-tunis.gov.tn', 'À affecter', 'Affectée', 'Équipe affectée', 295),
    (6, 'contact.citoyen@commune-tunis.gov.tn', 'Affectée', 'En cours', 'Intervention démarrée sur place', 276),
    (6, 'contact.citoyen@commune-tunis.gov.tn', 'En cours', 'À valider', 'Compte rendu soumis', 262),
    (6, 'contact.citoyen@commune-tunis.gov.tn', 'À valider', 'Terminée', 'Compte rendu validé', 260),
    (7, 'contact.citoyen@commune-tunis.gov.tn', 'À affecter', 'Affectée', 'Équipe affectée', 395),
    (7, 'r.jaziri@commune-tunis.gov.tn', 'Affectée', 'En cours', 'Intervention démarrée sur place', 376),
    (7, 'r.jaziri@commune-tunis.gov.tn', 'En cours', 'À valider', 'Compte rendu soumis', 232),
    (7, 'contact.citoyen@commune-tunis.gov.tn', 'À valider', 'Terminée', 'Compte rendu validé', 230)
  ) AS v(intervention_id, who, old_status, new_status, comment, h)
  JOIN "USERS" u ON u.email = v.who;

UPDATE "REPORTS" r
   SET priority_score = LEAST(100, ROUND(
         COALESCE(c.severity_weight, 0) * 10
       + COALESCE(c.risk_weight, 0) * 6
       + LEAST((SELECT COUNT(*) FROM "SUPPORTS" s WHERE s.report_id = r.id), 10) * 2
       + LEAST(EXTRACT(DAY FROM now() - r.created_at), 10)
       ))::smallint
  FROM "CATEGORIES" c
 WHERE c.id = r.category_id;
