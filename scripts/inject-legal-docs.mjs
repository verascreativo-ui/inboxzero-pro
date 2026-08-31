/**
 * One-shot helper: merges legalDocs into locale JSON files.
 * Run: node scripts/inject-legal-docs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '..', 'locales');
const EMAIL = 'soporte@inboxzero.es';
const MAIL = `<a href="mailto:${EMAIL}">${EMAIL}</a>`;

const docs = {
  es: {
    legal: {
      title: 'Aviso Legal',
      intro: `Información legal del sitio web InboxZero.es. Para cualquier consulta: ${MAIL}.`,
      sections: [
        {
          heading: '1. Datos identificativos',
          paragraphs: [
            'En cumplimiento de la normativa aplicable, se informa de que el titular del sitio web InboxZero.es (en adelante, «InboxZero») es el responsable del servicio digital de biblioteca de conocimiento accesible en https://inboxzero.es.',
            `Datos de contacto del responsable: ${MAIL}.`,
          ],
        },
        {
          heading: '2. Objeto',
          paragraphs: [
            'El presente aviso legal regula el acceso, navegación y uso del sitio web, así como las responsabilidades derivadas de la utilización de sus contenidos, productos y servicios, incluida la aplicación web InboxZero.',
          ],
        },
        {
          heading: '3. Condiciones de uso',
          paragraphs: [
            'El acceso al sitio web atribuye la condición de usuario e implica la aceptación plena de este aviso legal y del resto de políticas publicadas. El usuario se compromete a hacer un uso adecuado, lícito y de buena fe de la plataforma.',
          ],
          list: [
            'No emplear el servicio con fines ilícitos o contrarios a la buena fe.',
            'No dañar, inutilizar o sobrecargar los sistemas de InboxZero.',
            'No introducir malware ni intentar acceder sin autorización a cuentas o datos de terceros.',
          ],
        },
        {
          heading: '4. Propiedad intelectual e industrial',
          paragraphs: [
            'Todos los contenidos del sitio (textos, diseños, logotipos, código, bases de datos y demás elementos) están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su reproducción, distribución o transformación sin autorización previa del titular, salvo usos permitidos por ley.',
          ],
        },
        {
          heading: '5. Responsabilidad',
          paragraphs: [
            'InboxZero procura la continuidad y corrección del servicio, pero no garantiza la ausencia total de interrupciones, errores o vulnerabilidades. El usuario es responsable de la veracidad de la información que introduce y del uso que haga de los enlaces y contenidos guardados.',
            `Para notificar incidencias o contenidos ilícitos: ${MAIL}.`,
          ],
        },
        {
          heading: '6. Enlaces externos',
          paragraphs: [
            'El servicio permite guardar enlaces a sitios de terceros. InboxZero no controla ni se responsabiliza de dichos sitios ni de sus políticas. La inclusión de un enlace no implica aprobación de sus contenidos.',
          ],
        },
        {
          heading: '7. Legislación aplicable',
          paragraphs: [
            'Este aviso legal se rige por la legislación española y europea aplicable. Para cualquier controversia, las partes se someten a los juzgados y tribunales competentes conforme a la normativa de consumidores y usuarios cuando proceda.',
            `Contacto de soporte: ${MAIL}.`,
          ],
        },
      ],
    },
    privacy: {
      title: 'Política de Privacidad',
      intro: `Tratamiento de datos personales conforme al Reglamento (UE) 2016/679 (RGPD) y la LOPDGDD. Responsable del tratamiento / contacto: ${MAIL}.`,
      sections: [
        {
          heading: '1. Responsable del tratamiento',
          paragraphs: [
            'El responsable del tratamiento de los datos personales recogidos a través de InboxZero.es es InboxZero.',
            `Dirección de contacto y soporte en materia de protección de datos: ${MAIL}.`,
          ],
        },
        {
          heading: '2. Datos que tratamos',
          paragraphs: [
            'Podemos tratar, según el uso del servicio:',
          ],
          list: [
            'Datos de cuenta: correo electrónico y credenciales de autenticación.',
            'Datos de perfil o facturación asociados a la suscripción (p. ej. nombre), cuando proceda.',
            'Contenidos de la biblioteca del usuario (fichas, enlaces, notas, categorías y preferencias).',
            'Datos técnicos de uso (dirección IP, tipo de dispositivo/navegador, registros de seguridad) en la medida necesaria para prestar y proteger el servicio.',
          ],
        },
        {
          heading: '3. Finalidades y base jurídica',
          paragraphs: [
            'Tratamos los datos para:',
          ],
          list: [
            'Prestar el servicio InboxZero y gestionar la cuenta (ejecución de contrato / medidas precontractuales).',
            'Gestionar suscripciones, pagos y soporte (ejecución de contrato e interés legítimo).',
            'Cumplir obligaciones legales (p. ej. fiscales o de seguridad).',
            'Mejorar la seguridad y prevenir abusos (interés legítimo).',
            'Enviar comunicaciones esenciales del servicio; el marketing solo con consentimiento cuando sea exigible.',
          ],
        },
        {
          heading: '4. Destinatarios y encargados',
          paragraphs: [
            'No vendemos datos personales. Podemos compartirlos con proveedores que actúan como encargados del tratamiento (alojamiento, autenticación, pasarela de pago u otros servicios técnicos), bajo contrato y con garantías adecuadas, incluidos eventuales traslados internacionales conforme al RGPD.',
            `Para más información sobre encargados: ${MAIL}.`,
          ],
        },
        {
          heading: '5. Conservación',
          paragraphs: [
            'Conservamos los datos mientras la cuenta esté activa y durante los plazos necesarios para cumplir obligaciones legales o defender reclamaciones. Tras la baja, eliminaremos o anonimizaremos los datos cuando ya no sean necesarios, salvo bloqueo legal.',
          ],
        },
        {
          heading: '6. Derechos de las personas usuarias',
          paragraphs: [
            'Puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, así como retirar el consentimiento cuando la base sea el consentimiento, escribiendo a:',
            MAIL,
            'También puede reclamar ante la Agencia Española de Protección de Datos (AEPD) u otra autoridad de control competente.',
          ],
        },
        {
          heading: '7. Seguridad y menores',
          paragraphs: [
            'Aplicamos medidas técnicas y organizativas adecuadas para proteger los datos. El servicio no está dirigido a menores de 14 años (o la edad mínima aplicable). Si detecta datos de un menor sin autorización, contacte en ' + MAIL + '.',
          ],
        },
        {
          heading: '8. Cambios',
          paragraphs: [
            `Podemos actualizar esta política para reflejar cambios legales o del servicio. La versión vigente se publicará en la aplicación. Consultas: ${MAIL}.`,
          ],
        },
      ],
    },
    cookies: {
      title: 'Política de Cookies',
      intro: `Información sobre el uso de cookies y tecnologías similares en InboxZero.es. Contacto: ${MAIL}.`,
      sections: [
        {
          heading: '1. ¿Qué son las cookies?',
          paragraphs: [
            'Las cookies son pequeños archivos que se almacenan en su dispositivo al visitar un sitio web. Permiten recordar preferencias, mantener sesiones o entender cómo se usa el servicio.',
          ],
        },
        {
          heading: '2. Tipos de cookies que podemos utilizar',
          list: [
            'Cookies técnicas o necesarias: imprescindibles para el funcionamiento (p. ej. sesión, seguridad, idioma o almacenamiento local de preferencias).',
            'Cookies de preferencias: recuerdan elecciones del usuario, como el idioma de la interfaz.',
            'Cookies analíticas (si se activan): ayudan a comprender el uso agregado del servicio para mejorarlo.',
            'Cookies de terceros: asociadas a proveedores (p. ej. autenticación o pagos) conforme a sus propias políticas.',
          ],
        },
        {
          heading: '3. Base jurídica',
          paragraphs: [
            'Las cookies estrictamente necesarias se basan en el interés legítimo / necesidad de prestar el servicio solicitado. El resto, cuando se utilicen, se instalarán tras obtener el consentimiento cuando la normativa lo exija.',
          ],
        },
        {
          heading: '4. Gestión y retirada',
          paragraphs: [
            'Puede configurar su navegador para rechazar o eliminar cookies. Tenga en cuenta que desactivar cookies técnicas puede afectar al funcionamiento de InboxZero (inicio de sesión, idioma, etc.).',
            `Si necesita ayuda para gestionar cookies o ejercer derechos relacionados: ${MAIL}.`,
          ],
        },
        {
          heading: '5. Actualizaciones',
          paragraphs: [
            `Esta política puede actualizarse. La versión publicada en la aplicación será la aplicable. Contacto: ${MAIL}.`,
          ],
        },
      ],
    },
    terms: {
      title: 'Términos y Condiciones',
      intro: `Condiciones de uso del servicio InboxZero. Soporte: ${MAIL}.`,
      sections: [
        {
          heading: '1. Aceptación',
          paragraphs: [
            'Al registrarse, suscribirse o usar InboxZero, usted acepta estos Términos y Condiciones, el Aviso Legal y la Política de Privacidad. Si no está de acuerdo, no utilice el servicio.',
          ],
        },
        {
          heading: '2. Descripción del servicio',
          paragraphs: [
            'InboxZero es una aplicación que permite guardar, organizar y consultar enlaces y conocimiento en fichas. Las funcionalidades pueden evolucionar; se informará de cambios relevantes cuando proceda.',
          ],
        },
        {
          heading: '3. Cuenta de usuario',
          paragraphs: [
            'Usted es responsable de la confidencialidad de sus credenciales y de la actividad realizada con su cuenta. Notifique de inmediato cualquier uso no autorizado a ' + MAIL + '.',
          ],
        },
        {
          heading: '4. Plan de prueba y suscripción',
          paragraphs: [
            'Puede existir un plan de prueba gratuito con límites (p. ej. número de fichas). Superado el límite o finalizado el periodo, el acceso a funciones de guardado o premium puede requerir suscripción de pago gestionada a través de proveedores como Stripe.',
            'La suscripción Premium se renueva automáticamente al final de cada periodo de facturación (mensual o anual, según el plan elegido), y el importe correspondiente se cargará automáticamente al método de pago registrado, salvo que el usuario cancele antes de la fecha de renovación. Al solicitar la baja, el acceso a las funciones Premium se mantiene activo hasta el final del periodo ya abonado, sin que se realicen cargos adicionales a partir de esa fecha; transcurrido dicho periodo, la cuenta pasará automáticamente al plan gratuito con sus límites correspondientes. Las condiciones de reembolso, cuando resulten aplicables conforme a la normativa vigente, se detallarán en el proceso de contratación.',
            'El usuario dispone de un plazo de catorce (14) días naturales desde la confirmación del pago inicial de la suscripción para ejercer su derecho de desistimiento y solicitar el reembolso íntegro del importe abonado, sin necesidad de justificación, escribiendo a soporte@inboxzero.es. Transcurrido dicho plazo, no se realizarán reembolsos por el periodo en curso; no obstante, el usuario podrá cancelar en cualquier momento, manteniendo el acceso Premium hasta el final del periodo ya abonado, tal como se indica en el párrafo anterior. Este derecho de desistimiento se aplica a la contratación inicial de la suscripción; las renovaciones automáticas de un servicio ya contratado no generan un nuevo plazo de desistimiento independiente.',
            `Consultas sobre facturación o baja: ${MAIL}.`,
          ],
        },
        {
          heading: '5. Contenido del usuario',
          paragraphs: [
            'Usted conserva los derechos sobre el contenido que guarda. Nos otorga una licencia limitada para alojarlo y mostrarlo con el fin de prestar el servicio. Garantiza que dispone de derechos suficientes sobre dicho contenido y que no infringe derechos de terceros ni la ley.',
          ],
        },
        {
          heading: '6. Uso aceptable',
          paragraphs: [
            'Queda prohibido el uso del servicio para actividades ilícitas, spam, vulneración de sistemas, acoso o distribución de contenido ilegal. InboxZero podrá suspender o cancelar cuentas ante incumplimientos graves.',
          ],
        },
        {
          heading: '7. Disponibilidad y limitación de responsabilidad',
          paragraphs: [
            'El servicio se ofrece «tal cual», dentro de lo razonable. En la medida permitida por la ley, InboxZero no responde de daños indirectos, lucro cesante o pérdida de datos derivada de causas ajenas a su control razonable, sin perjuicio de los derechos irrenunciables de consumidores.',
          ],
        },
        {
          heading: '8. Modificaciones y contacto',
          paragraphs: [
            'Podemos modificar estos términos publicando la versión actualizada en la aplicación. El uso continuado tras la entrada en vigor implica aceptación, cuando la ley lo permita.',
            `Contacto de soporte y reclamaciones: ${MAIL}.`,
          ],
        },
      ],
    },
  },
};

// English
docs.en = {
  legal: {
    title: 'Legal Notice',
    intro: `Legal information for the InboxZero.es website. For any enquiry: ${MAIL}.`,
    sections: [
      {
        heading: '1. Identifying details',
        paragraphs: [
          'In accordance with applicable law, the owner of the InboxZero.es website (hereinafter “InboxZero”) is the controller of the digital knowledge-library service available at https://inboxzero.es.',
          `Controller contact details: ${MAIL}.`,
        ],
      },
      {
        heading: '2. Purpose',
        paragraphs: [
          'This legal notice governs access to, browsing and use of the website, as well as responsibilities arising from the use of its content, products and services, including the InboxZero web application.',
        ],
      },
      {
        heading: '3. Terms of use',
        paragraphs: [
          'Access to the website confers user status and implies full acceptance of this legal notice and other published policies. You agree to use the platform lawfully and in good faith.',
        ],
        list: [
          'Do not use the service for unlawful purposes or contrary to good faith.',
          'Do not damage, disable or overload InboxZero systems.',
          'Do not introduce malware or attempt unauthorised access to third-party accounts or data.',
        ],
      },
      {
        heading: '4. Intellectual and industrial property',
        paragraphs: [
          'All site content (texts, designs, logos, code, databases and other elements) is protected by intellectual and industrial property laws. Reproduction, distribution or transformation without prior authorisation is prohibited, except where permitted by law.',
        ],
      },
      {
        heading: '5. Liability',
        paragraphs: [
          'InboxZero endeavours to keep the service available and accurate, but does not guarantee uninterrupted operation or the total absence of errors. You are responsible for the accuracy of information you enter and for how you use saved links and content.',
          `To report incidents or unlawful content: ${MAIL}.`,
        ],
      },
      {
        heading: '6. External links',
        paragraphs: [
          'The service lets you save links to third-party sites. InboxZero does not control those sites or their policies. A saved link does not imply endorsement of their content.',
        ],
      },
      {
        heading: '7. Governing law',
        paragraphs: [
          'This legal notice is governed by applicable Spanish and European law. Disputes shall be submitted to the competent courts, without prejudice to mandatory consumer protection rules.',
          `Support contact: ${MAIL}.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: `Personal data processing under Regulation (EU) 2016/679 (GDPR) and applicable national law. Data controller / contact: ${MAIL}.`,
    sections: [
      {
        heading: '1. Data controller',
        paragraphs: [
          'The controller of personal data collected through InboxZero.es is InboxZero.',
          `Data protection and support contact: ${MAIL}.`,
        ],
      },
      {
        heading: '2. Data we process',
        paragraphs: ['Depending on how you use the service, we may process:'],
        list: [
          'Account data: email address and authentication credentials.',
          'Profile or billing data linked to a subscription (e.g. name), where applicable.',
          'Library content (cards, links, notes, categories and preferences).',
          'Technical usage data (IP address, device/browser type, security logs) as needed to provide and protect the service.',
        ],
      },
      {
        heading: '3. Purposes and legal bases',
        paragraphs: ['We process data in order to:'],
        list: [
          'Provide InboxZero and manage your account (performance of a contract / pre-contractual steps).',
          'Manage subscriptions, payments and support (contract and legitimate interests).',
          'Comply with legal obligations (e.g. tax or security).',
          'Improve security and prevent abuse (legitimate interests).',
          'Send essential service communications; marketing only with consent where required.',
        ],
      },
      {
        heading: '4. Recipients and processors',
        paragraphs: [
          'We do not sell personal data. We may share data with processors (hosting, authentication, payment gateways or other technical providers) under contract with appropriate safeguards, including international transfers where applicable under the GDPR.',
          `For more information about processors: ${MAIL}.`,
        ],
      },
      {
        heading: '5. Retention',
        paragraphs: [
          'We retain data while your account is active and for as long as needed to meet legal obligations or handle claims. After account closure we delete or anonymise data when it is no longer required, subject to legal blocking where mandatory.',
        ],
      },
      {
        heading: '6. Your rights',
        paragraphs: [
          'You may exercise rights of access, rectification, erasure, objection, restriction and portability, and withdraw consent where processing is based on consent, by writing to:',
          MAIL,
          'You may also lodge a complaint with the Spanish Data Protection Agency (AEPD) or another competent supervisory authority.',
        ],
      },
      {
        heading: '7. Security and minors',
        paragraphs: [
          'We apply appropriate technical and organisational measures to protect data. The service is not directed at children under 14 (or the applicable minimum age). If you become aware of a child’s data processed without authorisation, contact ' + MAIL + '.',
        ],
      },
      {
        heading: '8. Changes',
        paragraphs: [
          `We may update this policy to reflect legal or service changes. The current version will be published in the app. Enquiries: ${MAIL}.`,
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    intro: `Information about cookies and similar technologies on InboxZero.es. Contact: ${MAIL}.`,
    sections: [
      {
        heading: '1. What are cookies?',
        paragraphs: [
          'Cookies are small files stored on your device when you visit a website. They can remember preferences, keep you signed in or help us understand how the service is used.',
        ],
      },
      {
        heading: '2. Types of cookies we may use',
        list: [
          'Technical/necessary cookies: essential for operation (e.g. session, security, language or local preference storage).',
          'Preference cookies: remember choices such as interface language.',
          'Analytics cookies (if enabled): help us understand aggregated usage to improve the service.',
          'Third-party cookies: set by providers (e.g. authentication or payments) under their own policies.',
        ],
      },
      {
        heading: '3. Legal basis',
        paragraphs: [
          'Strictly necessary cookies rely on legitimate interests / necessity to provide the requested service. Other cookies, when used, will be placed after consent where required by law.',
        ],
      },
      {
        heading: '4. Managing cookies',
        paragraphs: [
          'You can configure your browser to refuse or delete cookies. Disabling technical cookies may affect InboxZero (sign-in, language, etc.).',
          `For help managing cookies or related rights: ${MAIL}.`,
        ],
      },
      {
        heading: '5. Updates',
        paragraphs: [
          `This policy may be updated. The version published in the app applies. Contact: ${MAIL}.`,
        ],
      },
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    intro: `Terms of use for the InboxZero service. Support: ${MAIL}.`,
    sections: [
      {
        heading: '1. Acceptance',
        paragraphs: [
          'By registering, subscribing or using InboxZero, you accept these Terms and Conditions, the Legal Notice and the Privacy Policy. If you disagree, do not use the service.',
        ],
      },
      {
        heading: '2. Service description',
        paragraphs: [
          'InboxZero is an application that lets you save, organise and browse links and knowledge as cards. Features may evolve; material changes will be communicated where appropriate.',
        ],
      },
      {
        heading: '3. User account',
        paragraphs: [
          'You are responsible for keeping your credentials confidential and for activity under your account. Report any unauthorised use immediately to ' + MAIL + '.',
        ],
      },
      {
        heading: '4. Free trial and subscription',
        paragraphs: [
          'A free trial plan with limits (e.g. number of cards) may apply. After the limit or trial period, saving or premium features may require a paid subscription processed via providers such as Stripe.',
          'The Premium subscription renews automatically at the end of each billing period (monthly or annual, depending on the chosen plan), and the corresponding amount will be automatically charged to the registered payment method, unless the user cancels before the renewal date. Upon requesting cancellation, access to Premium features remains active until the end of the already-paid period, with no further charges made after that date; once that period ends, the account will automatically switch to the free plan with its corresponding limits. Refund conditions, where applicable under current regulations, will be detailed during the checkout process.',
          'The user has a period of fourteen (14) calendar days from confirmation of the initial subscription payment to exercise their right of withdrawal and request a full refund of the amount paid, without providing any justification, by writing to soporte@inboxzero.es. After this period, no refunds will be issued for the current billing period; however, the user may cancel at any time, retaining Premium access until the end of the already-paid period, as described in the previous paragraph. This right of withdrawal applies to the initial subscription contract; automatic renewals of an already-contracted service do not generate a new, independent withdrawal period.',
          `Billing or cancellation enquiries: ${MAIL}.`,
        ],
      },
      {
        heading: '5. User content',
        paragraphs: [
          'You retain rights to content you save. You grant us a limited licence to host and display it to provide the service. You warrant that you have sufficient rights and that the content does not infringe third-party rights or the law.',
        ],
      },
      {
        heading: '6. Acceptable use',
        paragraphs: [
          'You must not use the service for unlawful activity, spam, system abuse, harassment or illegal content. InboxZero may suspend or terminate accounts for serious breaches.',
        ],
      },
      {
        heading: '7. Availability and limitation of liability',
        paragraphs: [
          'The service is provided “as is” within reason. To the extent permitted by law, InboxZero is not liable for indirect damages, lost profits or data loss outside its reasonable control, without prejudice to mandatory consumer rights.',
        ],
      },
      {
        heading: '8. Changes and contact',
        paragraphs: [
          'We may amend these terms by publishing an updated version in the app. Continued use after the effective date may constitute acceptance where allowed by law.',
          `Support and complaints: ${MAIL}.`,
        ],
      },
    ],
  },
};

// French
docs.fr = {
  legal: {
    title: 'Mentions légales',
    intro: `Informations légales du site InboxZero.es. Pour toute question : ${MAIL}.`,
    sections: [
      {
        heading: '1. Identification',
        paragraphs: [
          'Conformément à la réglementation applicable, le titulaire du site InboxZero.es (ci-après « InboxZero ») est responsable du service numérique de bibliothèque de connaissances accessible sur https://inboxzero.es.',
          `Coordonnées de contact : ${MAIL}.`,
        ],
      },
      {
        heading: '2. Objet',
        paragraphs: [
          'Les présentes mentions légales régissent l’accès, la navigation et l’utilisation du site, ainsi que les responsabilités liées à l’usage de ses contenus et services, y compris l’application web InboxZero.',
        ],
      },
      {
        heading: '3. Conditions d’utilisation',
        paragraphs: [
          'L’accès au site confère la qualité d’utilisateur et implique l’acceptation pleine des présentes mentions et des autres politiques publiées. L’utilisateur s’engage à un usage licite et de bonne foi.',
        ],
        list: [
          'Ne pas utiliser le service à des fins illicites.',
          'Ne pas endommager, désactiver ou surcharger les systèmes d’InboxZero.',
          'Ne pas introduire de logiciels malveillants ni tenter d’accéder sans autorisation aux comptes ou données de tiers.',
        ],
      },
      {
        heading: '4. Propriété intellectuelle',
        paragraphs: [
          'Tous les contenus du site (textes, designs, logos, code, bases de données, etc.) sont protégés. Toute reproduction, distribution ou transformation sans autorisation préalable est interdite, sauf exceptions légales.',
        ],
      },
      {
        heading: '5. Responsabilité',
        paragraphs: [
          'InboxZero s’efforce d’assurer la continuité du service, sans garantir l’absence totale d’interruptions ou d’erreurs. L’utilisateur est responsable de l’exactitude des informations saisies et de l’usage des liens enregistrés.',
          `Pour signaler un incident : ${MAIL}.`,
        ],
      },
      {
        heading: '6. Liens externes',
        paragraphs: [
          'Le service permet d’enregistrer des liens vers des sites tiers. InboxZero n’en contrôle pas le contenu ni les politiques. Un lien enregistré n’implique pas d’approbation.',
        ],
      },
      {
        heading: '7. Droit applicable',
        paragraphs: [
          'Les présentes mentions sont régies par le droit espagnol et européen applicable. Les litiges relèvent des juridictions compétentes, sous réserve des règles impératives de protection des consommateurs.',
          `Support : ${MAIL}.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    intro: `Traitement des données personnelles conformément au Règlement (UE) 2016/679 (RGPD). Responsable du traitement / contact : ${MAIL}.`,
    sections: [
      {
        heading: '1. Responsable du traitement',
        paragraphs: [
          'Le responsable du traitement des données collectées via InboxZero.es est InboxZero.',
          `Contact protection des données et support : ${MAIL}.`,
        ],
      },
      {
        heading: '2. Données traitées',
        paragraphs: ['Selon l’usage du service, nous pouvons traiter :'],
        list: [
          'Données de compte : e-mail et identifiants d’authentification.',
          'Données de profil ou de facturation liées à l’abonnement (p. ex. nom), le cas échéant.',
          'Contenus de la bibliothèque (fiches, liens, notes, catégories et préférences).',
          'Données techniques d’usage (IP, appareil/navigateur, journaux de sécurité) nécessaires à la prestation et à la sécurité.',
        ],
      },
      {
        heading: '3. Finalités et bases juridiques',
        paragraphs: ['Nous traitons les données afin de :'],
        list: [
          'Fournir InboxZero et gérer le compte (exécution du contrat / mesures précontractuelles).',
          'Gérer abonnements, paiements et support (contrat et intérêt légitime).',
          'Respecter les obligations légales.',
          'Renforcer la sécurité et prévenir les abus (intérêt légitime).',
          'Envoyer les communications essentielles du service ; le marketing uniquement avec consentement lorsque requis.',
        ],
      },
      {
        heading: '4. Destinataires',
        paragraphs: [
          'Nous ne vendons pas de données personnelles. Elles peuvent être partagées avec des sous-traitants (hébergement, authentification, paiement, etc.) sous contrat et avec des garanties appropriées, y compris pour les transferts internationaux conformément au RGPD.',
          `Pour en savoir plus : ${MAIL}.`,
        ],
      },
      {
        heading: '5. Conservation',
        paragraphs: [
          'Les données sont conservées pendant la durée d’activité du compte et les délais nécessaires aux obligations légales ou aux réclamations. Après résiliation, elles sont supprimées ou anonymisées lorsqu’elles ne sont plus nécessaires.',
        ],
      },
      {
        heading: '6. Vos droits',
        paragraphs: [
          'Vous pouvez exercer vos droits d’accès, de rectification, d’effacement, d’opposition, de limitation et de portabilité, et retirer votre consentement le cas échéant, en écrivant à :',
          MAIL,
          'Vous pouvez également introduire une réclamation auprès de l’AEPD ou d’une autre autorité de contrôle compétente.',
        ],
      },
      {
        heading: '7. Sécurité et mineurs',
        paragraphs: [
          'Des mesures techniques et organisationnelles appropriées sont appliquées. Le service ne s’adresse pas aux mineurs de moins de 14 ans (ou l’âge minimum applicable). Contact : ' + MAIL + '.',
        ],
      },
      {
        heading: '8. Modifications',
        paragraphs: [
          `Cette politique peut être mise à jour. La version publiée dans l’application fait foi. Contact : ${MAIL}.`,
        ],
      },
    ],
  },
  cookies: {
    title: 'Politique de cookies',
    intro: `Informations sur les cookies et technologies similaires sur InboxZero.es. Contact : ${MAIL}.`,
    sections: [
      {
        heading: '1. Qu’est-ce qu’un cookie ?',
        paragraphs: [
          'Les cookies sont de petits fichiers stockés sur votre appareil. Ils peuvent mémoriser des préférences, maintenir une session ou aider à comprendre l’usage du service.',
        ],
      },
      {
        heading: '2. Types de cookies',
        list: [
          'Cookies techniques/nécessaires : indispensables au fonctionnement (session, sécurité, langue, stockage local de préférences).',
          'Cookies de préférences : mémorisent des choix tels que la langue.',
          'Cookies analytiques (s’ils sont activés) : usage agrégé pour améliorer le service.',
          'Cookies tiers : déposés par des prestataires (authentification, paiement) selon leurs politiques.',
        ],
      },
      {
        heading: '3. Base juridique',
        paragraphs: [
          'Les cookies strictement nécessaires reposent sur l’intérêt légitime / la nécessité de fournir le service. Les autres, le cas échéant, après consentement lorsque la loi l’exige.',
        ],
      },
      {
        heading: '4. Gestion',
        paragraphs: [
          'Vous pouvez configurer votre navigateur pour refuser ou supprimer les cookies. La désactivation des cookies techniques peut affecter InboxZero.',
          `Aide : ${MAIL}.`,
        ],
      },
      {
        heading: '5. Mises à jour',
        paragraphs: [`Cette politique peut évoluer. Contact : ${MAIL}.`],
      },
    ],
  },
  terms: {
    title: 'Conditions générales',
    intro: `Conditions d’utilisation du service InboxZero. Support : ${MAIL}.`,
    sections: [
      {
        heading: '1. Acceptation',
        paragraphs: [
          'En vous inscrivant, en vous abonnant ou en utilisant InboxZero, vous acceptez les présentes Conditions, les Mentions légales et la Politique de confidentialité.',
        ],
      },
      {
        heading: '2. Description du service',
        paragraphs: [
          'InboxZero permet d’enregistrer, d’organiser et de consulter des liens et connaissances sous forme de fiches. Les fonctionnalités peuvent évoluer.',
        ],
      },
      {
        heading: '3. Compte utilisateur',
        paragraphs: [
          'Vous êtes responsable de la confidentialité de vos identifiants. Signalez tout usage non autorisé à ' + MAIL + '.',
        ],
      },
      {
        heading: '4. Essai gratuit et abonnement',
        paragraphs: [
          'Un forfait d’essai gratuit avec des limites (p. ex. nombre de fiches) peut s’appliquer. Au-delà, certaines fonctions peuvent nécessiter un abonnement payant (p. ex. via Stripe).',
          'L\'abonnement Premium se renouvelle automatiquement à la fin de chaque période de facturation (mensuelle ou annuelle, selon le forfait choisi), et le montant correspondant sera automatiquement débité du moyen de paiement enregistré, sauf si l\'utilisateur annule avant la date de renouvellement. En cas de demande de résiliation, l\'accès aux fonctionnalités Premium reste actif jusqu\'à la fin de la période déjà payée, sans frais supplémentaires après cette date ; à l\'issue de cette période, le compte basculera automatiquement vers le forfait gratuit avec ses limites correspondantes. Les conditions de remboursement, lorsqu\'elles sont applicables conformément à la réglementation en vigueur, seront précisées lors du processus de souscription.',
          'L\'utilisateur dispose d\'un délai de quatorze (14) jours calendaires à compter de la confirmation du paiement initial de l\'abonnement pour exercer son droit de rétractation et demander le remboursement intégral du montant payé, sans avoir à se justifier, en écrivant à soporte@inboxzero.es. Passé ce délai, aucun remboursement ne sera effectué pour la période en cours ; l\'utilisateur pourra néanmoins résilier à tout moment, en conservant l\'accès Premium jusqu\'à la fin de la période déjà payée, comme indiqué au paragraphe précédent. Ce droit de rétractation s\'applique à la souscription initiale de l\'abonnement ; les renouvellements automatiques d\'un service déjà souscrit ne génèrent pas de nouveau délai de rétractation indépendant.',
          `Facturation / résiliation : ${MAIL}.`,
        ],
      },
      {
        heading: '5. Contenu utilisateur',
        paragraphs: [
          'Vous conservez vos droits sur le contenu enregistré et nous concédez une licence limitée pour le héberger et l’afficher afin de fournir le service.',
        ],
      },
      {
        heading: '6. Usage acceptable',
        paragraphs: [
          'Sont interdits les usages illicites, le spam, les atteintes aux systèmes et la diffusion de contenus illégaux. InboxZero peut suspendre ou résilier les comptes en cas de manquement grave.',
        ],
      },
      {
        heading: '7. Disponibilité et responsabilité',
        paragraphs: [
          'Le service est fourni « en l’état » dans des conditions raisonnables. Dans les limites autorisées par la loi, InboxZero n’est pas responsable des dommages indirects, sous réserve des droits impératifs des consommateurs.',
        ],
      },
      {
        heading: '8. Modifications et contact',
        paragraphs: [
          'Nous pouvons modifier ces conditions en publiant une version mise à jour dans l’application.',
          `Support : ${MAIL}.`,
        ],
      },
    ],
  },
};

// German
docs.de = {
  legal: {
    title: 'Impressum / Rechtliche Hinweise',
    intro: `Rechtliche Informationen zur Website InboxZero.es. Kontakt: ${MAIL}.`,
    sections: [
      {
        heading: '1. Anbieterkennzeichnung',
        paragraphs: [
          'Verantwortlich für die Website InboxZero.es (nachfolgend „InboxZero“) ist der Anbieter des digitalen Wissensbibliothek-Dienstes unter https://inboxzero.es.',
          `Kontakt: ${MAIL}.`,
        ],
      },
      {
        heading: '2. Gegenstand',
        paragraphs: [
          'Diese Hinweise regeln den Zugang und die Nutzung der Website sowie Verantwortlichkeiten im Zusammenhang mit Inhalten und Diensten, einschließlich der Web-App InboxZero.',
        ],
      },
      {
        heading: '3. Nutzungsbedingungen',
        paragraphs: [
          'Der Zugriff auf die Website begründet die Nutzereigenschaft und die vollständige Zustimmung zu diesen Hinweisen sowie den weiteren veröffentlichten Richtlinien. Die Nutzung hat rechtmäßig und nach Treu und Glauben zu erfolgen.',
        ],
        list: [
          'Keine rechtswidrige Nutzung des Dienstes.',
          'Keine Beschädigung, Deaktivierung oder Überlastung der Systeme von InboxZero.',
          'Kein Einschleusen von Schadsoftware und kein unbefugter Zugriff auf fremde Konten oder Daten.',
        ],
      },
      {
        heading: '4. Geistiges Eigentum',
        paragraphs: [
          'Alle Inhalte der Website sind urheber- und kennzeichenrechtlich geschützt. Vervielfältigung, Verbreitung oder Bearbeitung ohne vorherige Zustimmung sind – außer in gesetzlich zulässigen Fällen – untersagt.',
        ],
      },
      {
        heading: '5. Haftung',
        paragraphs: [
          'InboxZero bemüht sich um Verfügbarkeit und Korrektheit, übernimmt jedoch keine Garantie für unterbrechungsfreien Betrieb. Nutzer sind für eingegebene Informationen und die Nutzung gespeicherter Links verantwortlich.',
          `Vorfälle melden: ${MAIL}.`,
        ],
      },
      {
        heading: '6. Externe Links',
        paragraphs: [
          'Gespeicherte Links können auf Drittseiten verweisen. InboxZero kontrolliert diese nicht und übernimmt keine Verantwortung für deren Inhalte oder Richtlinien.',
        ],
      },
      {
        heading: '7. Anwendbares Recht',
        paragraphs: [
          'Es gilt das anwendbare spanische und europäische Recht. Zuständig sind die gesetzlichen Gerichtsstände, unbeschadet zwingender Verbraucherschutzvorschriften.',
          `Support: ${MAIL}.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Datenschutzerklärung',
    intro: `Verarbeitung personenbezogener Daten gemäß Verordnung (EU) 2016/679 (DSGVO). Verantwortlicher / Kontakt: ${MAIL}.`,
    sections: [
      {
        heading: '1. Verantwortlicher',
        paragraphs: [
          'Verantwortlicher für die über InboxZero.es erhobenen personenbezogenen Daten ist InboxZero.',
          `Datenschutz- und Support-Kontakt: ${MAIL}.`,
        ],
      },
      {
        heading: '2. Verarbeitete Daten',
        paragraphs: ['Je nach Nutzung können wir verarbeiten:'],
        list: [
          'Kontodaten: E-Mail-Adresse und Authentifizierungsdaten.',
          'Profil- oder Abrechnungsdaten im Zusammenhang mit einem Abonnement (z. B. Name), soweit erforderlich.',
          'Bibliotheksinhalte (Karten, Links, Notizen, Kategorien und Einstellungen).',
          'Technische Nutzungsdaten (IP, Gerät/Browser, Sicherheitsprotokolle) zur Bereitstellung und Absicherung des Dienstes.',
        ],
      },
      {
        heading: '3. Zwecke und Rechtsgrundlagen',
        paragraphs: ['Wir verarbeiten Daten, um:'],
        list: [
          'InboxZero bereitzustellen und das Konto zu verwalten (Vertragserfüllung / vorvertragliche Maßnahmen).',
          'Abonnements, Zahlungen und Support zu verwalten (Vertrag und berechtigtes Interesse).',
          'Rechtliche Pflichten zu erfüllen.',
          'Sicherheit zu verbessern und Missbrauch zu verhindern (berechtigtes Interesse).',
          'Wesentliche Service-Mitteilungen zu senden; Marketing nur mit Einwilligung, soweit erforderlich.',
        ],
      },
      {
        heading: '4. Empfänger',
        paragraphs: [
          'Wir verkaufen keine personenbezogenen Daten. Eine Weitergabe an Auftragsverarbeiter (Hosting, Authentifizierung, Zahlung usw.) erfolgt vertraglich und mit angemessenen Garantien, einschließlich internationaler Übermittlungen nach DSGVO.',
          `Weitere Informationen: ${MAIL}.`,
        ],
      },
      {
        heading: '5. Speicherdauer',
        paragraphs: [
          'Daten werden während der aktiven Kontonutzung und für gesetzlich erforderliche Fristen gespeichert. Nach Kontolöschung werden sie gelöscht oder anonymisiert, sobald sie nicht mehr benötigt werden.',
        ],
      },
      {
        heading: '6. Ihre Rechte',
        paragraphs: [
          'Sie können Auskunft, Berichtigung, Löschung, Widerspruch, Einschränkung und Datenübertragbarkeit verlangen sowie eine Einwilligung widerrufen, indem Sie schreiben an:',
          MAIL,
          'Sie können zudem Beschwerde bei der AEPD oder einer anderen zuständigen Aufsichtsbehörde einlegen.',
        ],
      },
      {
        heading: '7. Sicherheit und Minderjährige',
        paragraphs: [
          'Wir setzen angemessene technische und organisatorische Maßnahmen ein. Der Dienst richtet sich nicht an Personen unter 14 Jahren (oder dem geltenden Mindestalter). Kontakt: ' + MAIL + '.',
        ],
      },
      {
        heading: '8. Änderungen',
        paragraphs: [
          `Diese Erklärung kann aktualisiert werden. Maßgeblich ist die in der App veröffentlichte Fassung. Kontakt: ${MAIL}.`,
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie-Richtlinie',
    intro: `Informationen zu Cookies und ähnlichen Technologien auf InboxZero.es. Kontakt: ${MAIL}.`,
    sections: [
      {
        heading: '1. Was sind Cookies?',
        paragraphs: [
          'Cookies sind kleine Dateien, die auf Ihrem Gerät gespeichert werden. Sie können Einstellungen speichern, Sitzungen aufrechterhalten oder die Nutzung des Dienstes besser verständlich machen.',
        ],
      },
      {
        heading: '2. Cookie-Arten',
        list: [
          'Technisch notwendige Cookies: für den Betrieb erforderlich (Sitzung, Sicherheit, Sprache, lokale Einstellungen).',
          'Präferenz-Cookies: speichern z. B. die Oberflächensprache.',
          'Analyse-Cookies (falls aktiviert): aggregierte Nutzung zur Verbesserung.',
          'Drittanbieter-Cookies: z. B. durch Authentifizierungs- oder Zahlungsanbieter.',
        ],
      },
      {
        heading: '3. Rechtsgrundlage',
        paragraphs: [
          'Strikt notwendige Cookies stützen sich auf berechtigte Interessen / Erforderlichkeit. Sonstige Cookies nur nach Einwilligung, soweit gesetzlich erforderlich.',
        ],
      },
      {
        heading: '4. Verwaltung',
        paragraphs: [
          'Sie können Cookies im Browser ablehnen oder löschen. Das Deaktivieren technischer Cookies kann die Funktion von InboxZero beeinträchtigen.',
          `Hilfe: ${MAIL}.`,
        ],
      },
      {
        heading: '5. Aktualisierungen',
        paragraphs: [`Diese Richtlinie kann aktualisiert werden. Kontakt: ${MAIL}.`],
      },
    ],
  },
  terms: {
    title: 'Allgemeine Geschäftsbedingungen',
    intro: `Nutzungsbedingungen für den Dienst InboxZero. Support: ${MAIL}.`,
    sections: [
      {
        heading: '1. Annahme',
        paragraphs: [
          'Mit Registrierung, Abonnement oder Nutzung von InboxZero akzeptieren Sie diese Bedingungen, die rechtlichen Hinweise und die Datenschutzerklärung.',
        ],
      },
      {
        heading: '2. Leistungsbeschreibung',
        paragraphs: [
          'InboxZero ermöglicht das Speichern, Organisieren und Abrufen von Links und Wissen in Karten. Funktionen können weiterentwickelt werden.',
        ],
      },
      {
        heading: '3. Nutzerkonto',
        paragraphs: [
          'Sie sind für die Vertraulichkeit Ihrer Zugangsdaten verantwortlich. Melden Sie unbefugte Nutzung unverzüglich an ' + MAIL + '.',
        ],
      },
      {
        heading: '4. Testphase und Abonnement',
        paragraphs: [
          'Es kann einen kostenlosen Testplan mit Limits (z. B. Kartenanzahl) geben. Danach können Speicher- oder Premium-Funktionen ein kostenpflichtiges Abonnement erfordern (z. B. über Stripe).',
          'Das Premium-Abonnement verlängert sich automatisch am Ende jedes Abrechnungszeitraums (monatlich oder jährlich, je nach gewähltem Plan), und der entsprechende Betrag wird automatisch der hinterlegten Zahlungsmethode belastet, sofern der Nutzer nicht vor dem Verlängerungsdatum kündigt. Bei einer Kündigung bleibt der Zugang zu den Premium-Funktionen bis zum Ende des bereits bezahlten Zeitraums aktiv, ohne dass danach weitere Kosten anfallen; nach Ablauf dieses Zeitraums wechselt das Konto automatisch zum kostenlosen Plan mit den entsprechenden Einschränkungen. Erstattungsbedingungen werden, sofern nach geltendem Recht anwendbar, im Bestellvorgang näher erläutert.',
          'Der Nutzer hat ab Bestätigung der ersten Abonnementzahlung eine Frist von vierzehn (14) Kalendertagen, um sein Widerrufsrecht auszuüben und die vollständige Rückerstattung des gezahlten Betrags zu verlangen, ohne eine Begründung angeben zu müssen, indem er sich an soporte@inboxzero.es wendet. Nach Ablauf dieser Frist erfolgen keine Rückerstattungen für den laufenden Zeitraum; der Nutzer kann jedoch jederzeit kündigen und behält den Premium-Zugang bis zum Ende des bereits bezahlten Zeitraums, wie im vorherigen Absatz beschrieben. Dieses Widerrufsrecht gilt für den ursprünglichen Abschluss des Abonnements; automatische Verlängerungen eines bereits abgeschlossenen Dienstes begründen keine neue, eigenständige Widerrufsfrist.',
          `Abrechnung / Kündigung: ${MAIL}.`,
        ],
      },
      {
        heading: '5. Nutzerinhalte',
        paragraphs: [
          'Sie behalten die Rechte an gespeicherten Inhalten und räumen uns eine beschränkte Lizenz ein, diese zur Leistungserbringung zu hosten und anzuzeigen.',
        ],
      },
      {
        heading: '6. Zulässige Nutzung',
        paragraphs: [
          'Rechtswidrige Nutzung, Spam, Systemmissbrauch und illegale Inhalte sind untersagt. Bei schweren Verstößen kann InboxZero Konten sperren oder kündigen.',
        ],
      },
      {
        heading: '7. Verfügbarkeit und Haftung',
        paragraphs: [
          'Der Dienst wird im Rahmen des Zumutbaren „wie besehen“ bereitgestellt. Soweit gesetzlich zulässig, haftet InboxZero nicht für indirekte Schäden, unbeschadet zwingender Verbraucherrechte.',
        ],
      },
      {
        heading: '8. Änderungen und Kontakt',
        paragraphs: [
          'Wir können diese Bedingungen durch Veröffentlichung einer aktualisierten Fassung in der App ändern.',
          `Support: ${MAIL}.`,
        ],
      },
    ],
  },
};

// Portuguese
docs.pt = {
  legal: {
    title: 'Aviso Legal',
    intro: `Informação legal do sítio InboxZero.es. Para qualquer questão: ${MAIL}.`,
    sections: [
      {
        heading: '1. Dados de identificação',
        paragraphs: [
          'Em cumprimento da legislação aplicável, o titular do sítio InboxZero.es (doravante «InboxZero») é o responsável pelo serviço digital de biblioteca de conhecimento disponível em https://inboxzero.es.',
          `Contacto: ${MAIL}.`,
        ],
      },
      {
        heading: '2. Objeto',
        paragraphs: [
          'O presente aviso legal regula o acesso, navegação e utilização do sítio, bem como as responsabilidades decorrentes do uso dos seus conteúdos e serviços, incluindo a aplicação web InboxZero.',
        ],
      },
      {
        heading: '3. Condições de utilização',
        paragraphs: [
          'O acesso ao sítio confere a qualidade de utilizador e implica a aceitação plena deste aviso e das restantes políticas publicadas. O utilizador compromete-se a um uso lícito e de boa-fé.',
        ],
        list: [
          'Não utilizar o serviço para fins ilícitos.',
          'Não danificar, inutilizar ou sobrecarregar os sistemas da InboxZero.',
          'Não introduzir malware nem tentar aceder sem autorização a contas ou dados de terceiros.',
        ],
      },
      {
        heading: '4. Propriedade intelectual',
        paragraphs: [
          'Todos os conteúdos do sítio estão protegidos. É proibida a reprodução, distribuição ou transformação sem autorização prévia, salvo nos casos permitidos por lei.',
        ],
      },
      {
        heading: '5. Responsabilidade',
        paragraphs: [
          'A InboxZero procura a continuidade do serviço, sem garantir a ausência total de interrupções ou erros. O utilizador é responsável pela veracidade da informação introduzida e pelo uso dos links guardados.',
          `Para reportar incidentes: ${MAIL}.`,
        ],
      },
      {
        heading: '6. Ligações externas',
        paragraphs: [
          'O serviço permite guardar ligações para sítios de terceiros. A InboxZero não controla esses sítios nem as suas políticas.',
        ],
      },
      {
        heading: '7. Lei aplicável',
        paragraphs: [
          'Este aviso rege-se pela legislação espanhola e europeia aplicável. Os litígios serão submetidos aos tribunais competentes, sem prejuízo das normas imperativas de proteção dos consumidores.',
          `Suporte: ${MAIL}.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Política de Privacidade',
    intro: `Tratamento de dados pessoais nos termos do Regulamento (UE) 2016/679 (RGPD). Responsável pelo tratamento / contacto: ${MAIL}.`,
    sections: [
      {
        heading: '1. Responsável pelo tratamento',
        paragraphs: [
          'O responsável pelo tratamento dos dados recolhidos através de InboxZero.es é a InboxZero.',
          `Contacto de proteção de dados e suporte: ${MAIL}.`,
        ],
      },
      {
        heading: '2. Dados que tratamos',
        paragraphs: ['Consoante a utilização do serviço, podemos tratar:'],
        list: [
          'Dados de conta: e-mail e credenciais de autenticação.',
          'Dados de perfil ou faturação associados à subscrição (p. ex. nome), quando aplicável.',
          'Conteúdos da biblioteca (fichas, links, notas, categorias e preferências).',
          'Dados técnicos de utilização (IP, dispositivo/navegador, registos de segurança) necessários para prestar e proteger o serviço.',
        ],
      },
      {
        heading: '3. Finalidades e bases jurídicas',
        paragraphs: ['Tratamos os dados para:'],
        list: [
          'Prestar o InboxZero e gerir a conta (execução de contrato / diligências pré-contratuais).',
          'Gerir subscrições, pagamentos e suporte (contrato e interesse legítimo).',
          'Cumprir obrigações legais.',
          'Melhorar a segurança e prevenir abusos (interesse legítimo).',
          'Enviar comunicações essenciais do serviço; marketing apenas com consentimento quando exigido.',
        ],
      },
      {
        heading: '4. Destinatários',
        paragraphs: [
          'Não vendemos dados pessoais. Podemos partilhá-los com subcontratantes (alojamento, autenticação, pagamentos, etc.) sob contrato e com garantias adequadas, incluindo transferências internacionais nos termos do RGPD.',
          `Mais informação: ${MAIL}.`,
        ],
      },
      {
        heading: '5. Conservação',
        paragraphs: [
          'Conservamos os dados enquanto a conta estiver ativa e pelos prazos necessários a obrigações legais ou reclamações. Após o cancelamento, eliminamos ou anonimizamos quando deixarem de ser necessários.',
        ],
      },
      {
        heading: '6. Direitos do titular',
        paragraphs: [
          'Pode exercer os direitos de acesso, retificação, apagamento, oposição, limitação e portabilidade, e retirar o consentimento quando aplicável, escrevendo para:',
          MAIL,
          'Também pode apresentar reclamação à AEPD ou a outra autoridade de controlo competente.',
        ],
      },
      {
        heading: '7. Segurança e menores',
        paragraphs: [
          'Aplicamos medidas técnicas e organizativas adequadas. O serviço não se destina a menores de 14 anos (ou idade mínima aplicável). Contacto: ' + MAIL + '.',
        ],
      },
      {
        heading: '8. Alterações',
        paragraphs: [
          `Esta política pode ser atualizada. Prevalece a versão publicada na aplicação. Contacto: ${MAIL}.`,
        ],
      },
    ],
  },
  cookies: {
    title: 'Política de Cookies',
    intro: `Informação sobre cookies e tecnologias semelhantes em InboxZero.es. Contacto: ${MAIL}.`,
    sections: [
      {
        heading: '1. O que são cookies?',
        paragraphs: [
          'Cookies são pequenos ficheiros armazenados no seu dispositivo. Permitem recordar preferências, manter sessões ou compreender a utilização do serviço.',
        ],
      },
      {
        heading: '2. Tipos de cookies',
        list: [
          'Cookies técnicas/necessárias: essenciais ao funcionamento (sessão, segurança, idioma, armazenamento local de preferências).',
          'Cookies de preferências: recordam escolhas como o idioma.',
          'Cookies analíticas (se ativadas): utilização agregada para melhorar o serviço.',
          'Cookies de terceiros: de fornecedores (autenticação ou pagamentos) segundo as suas políticas.',
        ],
      },
      {
        heading: '3. Base jurídica',
        paragraphs: [
          'As cookies estritamente necessárias baseiam-se no interesse legítimo / necessidade de prestar o serviço. As restantes, quando utilizadas, após consentimento quando a lei o exija.',
        ],
      },
      {
        heading: '4. Gestão',
        paragraphs: [
          'Pode configurar o navegador para recusar ou eliminar cookies. Desativar cookies técnicas pode afetar o InboxZero.',
          `Ajuda: ${MAIL}.`,
        ],
      },
      {
        heading: '5. Atualizações',
        paragraphs: [`Esta política pode ser atualizada. Contacto: ${MAIL}.`],
      },
    ],
  },
  terms: {
    title: 'Termos e Condições',
    intro: `Condições de utilização do serviço InboxZero. Suporte: ${MAIL}.`,
    sections: [
      {
        heading: '1. Aceitação',
        paragraphs: [
          'Ao registar-se, subscrever ou utilizar o InboxZero, aceita estes Termos, o Aviso Legal e a Política de Privacidade.',
        ],
      },
      {
        heading: '2. Descrição do serviço',
        paragraphs: [
          'O InboxZero permite guardar, organizar e consultar links e conhecimento em fichas. As funcionalidades podem evoluir.',
        ],
      },
      {
        heading: '3. Conta de utilizador',
        paragraphs: [
          'É responsável pela confidencialidade das credenciais. Comunique imediatamente qualquer uso não autorizado a ' + MAIL + '.',
        ],
      },
      {
        heading: '4. Plano de teste e subscrição',
        paragraphs: [
          'Pode existir um plano de teste gratuito com limites (p. ex. número de fichas). Após o limite, funções de guardar ou premium podem exigir subscrição paga (p. ex. via Stripe).',
          'A subscrição Premium renova-se automaticamente no final de cada período de faturação (mensal ou anual, consoante o plano escolhido), e o valor correspondente será cobrado automaticamente no método de pagamento registado, salvo se o utilizador cancelar antes da data de renovação. Ao solicitar o cancelamento, o acesso às funcionalidades Premium mantém-se ativo até ao final do período já pago, sem quaisquer cobranças adicionais a partir dessa data; após esse período, a conta passará automaticamente para o plano gratuito com os respetivos limites. As condições de reembolso, quando aplicáveis nos termos da legislação em vigor, serão detalhadas no processo de contratação.',
          'O utilizador dispõe de um prazo de catorze (14) dias de calendário a partir da confirmação do pagamento inicial da subscrição para exercer o seu direito de livre resolução e solicitar o reembolso integral do valor pago, sem necessidade de justificação, através do contacto soporte@inboxzero.es. Decorrido esse prazo, não serão efetuados reembolsos relativos ao período em curso; no entanto, o utilizador poderá cancelar a qualquer momento, mantendo o acesso Premium até ao final do período já pago, conforme indicado no parágrafo anterior. Este direito de livre resolução aplica-se à contratação inicial da subscrição; as renovações automáticas de um serviço já contratado não geram um novo prazo de resolução independente.',
          `Faturação / cancelamento: ${MAIL}.`,
        ],
      },
      {
        heading: '5. Conteúdo do utilizador',
        paragraphs: [
          'Mantém os direitos sobre o conteúdo guardado e concede-nos uma licença limitada para o alojar e apresentar a fim de prestar o serviço.',
        ],
      },
      {
        heading: '6. Utilização aceitável',
        paragraphs: [
          'É proibida a utilização ilícita, spam, abuso de sistemas ou conteúdos ilegais. A InboxZero pode suspender ou cancelar contas em caso de incumprimento grave.',
        ],
      },
      {
        heading: '7. Disponibilidade e responsabilidade',
        paragraphs: [
          'O serviço é prestado «tal como está» dentro do razoável. Na medida permitida por lei, a InboxZero não responde por danos indiretos, sem prejuízo dos direitos imperativos dos consumidores.',
        ],
      },
      {
        heading: '8. Alterações e contacto',
        paragraphs: [
          'Podemos alterar estes termos publicando a versão atualizada na aplicação.',
          `Suporte: ${MAIL}.`,
        ],
      },
    ],
  },
};

for (const locale of Object.keys(docs)) {
  const file = path.join(localesDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.legalDocs = docs[locale];
  data.support = {
    email: EMAIL,
    label: EMAIL,
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Updated', file);
}
