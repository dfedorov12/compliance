"use strict";

// Zentrale Konfiguration der DIHAG Compliance-Cockpit-SPA.
const CC_CONFIG = {
  // Entra-App-Registrierung „DIHAG Compliance"
  // (Objekt-ID 630e639b-d406-402e-bc34-4c9f87ef26bb).
  clientId: "a129024b-8b1a-4d54-89f4-8e6049b5f59b",
  tenantId: "fdb70646-023a-403b-a4b9-1f474a935123",

  // SharePoint-Site, auf der die Governance-Listen liegen.
  siteHostname: "dihag.sharepoint.com",
  sitePath: "/sites/IT",

  // Dokumentbibliothek für Nachweise (Ordner je Control-/Vorgangs-ID).
  nachweiseLibrary: "Compliance_Nachweise",

  // Schreibende Graph-Aktionen (Alert-Status, Aufbewahrungslabel anlegen,
  // eDiscovery-Fall anlegen). false = reines Lese-Cockpit für M365.
  erlaubeSchreibaktionen: true,

  maxAttachmentBytes: 10 * 1024 * 1024,
  mailMaxTotalBytes: 3 * 1024 * 1024,

  // Daten-Cache der SharePoint-Listen in Millisekunden.
  cacheTtlMs: 5 * 60 * 1000,

  appVersion: "1.0.0"
};

// Berechtigungen werden bewusst NICHT alle beim Login angefordert, sondern erst,
// wenn ein Modul sie braucht (inkrementeller Consent). Sonst sieht der Anwender
// beim ersten Start eine erschlagende Zustimmungsseite und ein einziges nicht
// konsentiertes Recht würde die ganze Anmeldung blockieren.
const CC_SCOPES = {
  base:        ["User.Read", "User.ReadBasic.All", "Sites.ReadWrite.All", "Mail.Send"],
  // Listen und Spalten anlegen: Sites.ReadWrite.All reicht dafür nicht, Graph
  // verlangt Sites.Manage.All. Wird nur bei „Listen prüfen / anlegen“ angefordert.
  verwalten:   ["Sites.Manage.All"],
  verzeichnis: ["User.Read.All"],
  alerts:      [CC_CONFIG.erlaubeSchreibaktionen ? "SecurityAlert.ReadWrite.All" : "SecurityAlert.Read.All",
                "SecurityIncident.Read.All"],
  secureScore: ["SecurityEvents.Read.All"],
  audit:       ["AuditLogsQuery.Read.All"],
  entraAudit:  ["AuditLog.Read.All"],
  // Vertraulichkeitsbezeichnungen: neue Schnittstelle dataSecurityAndGovernance
  // (mandantenweit bzw. für den Benutzer), die alte informationProtection nur noch
  // als Rückfallebene.
  labels:      ["SensitivityLabels.Read.All"],
  labelsUser:  ["SensitivityLabel.Read"],
  labelsAlt:   ["InformationProtectionPolicy.Read"],
  retention:   [CC_CONFIG.erlaubeSchreibaktionen ? "RecordsManagement.ReadWrite.All" : "RecordsManagement.Read.All"],
  ediscovery:  [CC_CONFIG.erlaubeSchreibaktionen ? "eDiscovery.ReadWrite.All" : "eDiscovery.Read.All"],
  privacy:     [CC_CONFIG.erlaubeSchreibaktionen ? "SubjectRightsRequest.ReadWrite.All" : "SubjectRightsRequest.Read.All"],
  geraete:     ["DeviceManagementConfiguration.Read.All", "DeviceManagementManagedDevices.Read.All"],
  richtlinien: ["Policy.Read.All"],
  rollen:      ["RoleManagement.Read.Directory"]
};

// Namen der SharePoint-Listen (zentral, damit Provisionierung und App identisch sind).
// Controls/SoA, Risiken, Vorfälle und Maßnahmen führt das RMS (siehe rms.js).
// Das Cockpit hält nur, was es im RMS nicht gibt: Datenschutz-Register und die
// gesicherten M365-Nachweise je Control.
const CC_LISTS = {
  vvt:        "Compliance_VVT",
  tom:        "Compliance_TOM",
  avv:        "Compliance_AVV",
  anfragen:   "Compliance_Anfragen",
  nachweise:  "Compliance_M365Nachweise",
  konfig:     "Compliance_Konfiguration"
};
