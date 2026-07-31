<#
.SYNOPSIS
    Richtet die Entra-App-Registrierung „DIHAG Compliance" fuer das Compliance-Cockpit ein.

.DESCRIPTION
    * traegt die SPA-Redirect-URIs ein (GitHub Pages + optionale Custom Domain + lokaler Test)
    * hinterlegt alle benoetigten delegierten Microsoft-Graph-Berechtigungen
    * erteilt die Administratorzustimmung fuer den gesamten Mandanten
    * gibt anschliessend eine Pruefliste aus

    Ausfuehren als Benutzer mit der Rolle „Globaler Administrator" bzw.
    „Anwendungsadministrator" + „Administrator fuer privilegierte Rollen".

.NOTES
    Benoetigt das Modul Microsoft.Graph:
        Install-Module Microsoft.Graph -Scope CurrentUser
#>

param(
    [string]$ClientId = "a129024b-8b1a-4d54-89f4-8e6049b5f59b",
    [string]$TenantId = "fdb70646-023a-403b-a4b9-1f474a935123",
    [string[]]$RedirectUris = @(
        "https://dfedorov12.github.io/compliance/",
        "http://localhost:8080/"
    ),
    [switch]$NurLesen   # nur Lese-Berechtigungen anfordern (Read-only-Cockpit)
)

$ErrorActionPreference = "Stop"
$GraphAppId = "00000003-0000-0000-c000-000000000000"

# Delegierte Berechtigungen des Cockpits ------------------------------------
$Scopes = @(
    "User.Read"                              # Anmeldung, eigenes Profil
    "User.ReadBasic.All"                     # Namen von Verantwortlichen
    "User.Read.All"                          # Benutzerstatistik (Gaeste, deaktiviert)
    "Sites.ReadWrite.All"                    # SharePoint-Listen der Governance-Schicht
    "Mail.Send"                              # Meldeentwurf an den DSB senden
    "SecurityEvents.Read.All"                # Secure Score
    "SecurityIncident.Read.All"              # Vorfaelle Defender XDR
    "AuditLogsQuery.Read.All"                # Einheitliches Ueberwachungsprotokoll
    "AuditLog.Read.All"                      # Entra-Verzeichnisprotokoll
    "InformationProtectionPolicy.Read"       # Vertraulichkeitsbezeichnungen
    "Policy.Read.All"                        # Bedingter Zugriff
    "RoleManagement.Read.Directory"          # Privilegierte Verzeichnisrollen
    "DeviceManagementConfiguration.Read.All" # Geraetekonformitaetsrichtlinien
    "DeviceManagementManagedDevices.Read.All"# Verwaltete Geraete
)
if ($NurLesen) {
    $Scopes += @("SecurityAlert.Read.All", "RecordsManagement.Read.All",
                 "eDiscovery.Read.All", "SubjectRightsRequest.Read.All")
} else {
    $Scopes += @("SecurityAlert.ReadWrite.All",   # Warnungen bearbeiten/schliessen
                 "RecordsManagement.ReadWrite.All", # Aufbewahrungsbezeichnungen anlegen
                 "eDiscovery.ReadWrite.All",      # eDiscovery-Faelle anlegen
                 "SubjectRightsRequest.ReadWrite.All")
}

Write-Host "== DIHAG Compliance – Einrichtung der App-Registrierung ==" -ForegroundColor Cyan
Write-Host "App:    $ClientId"
Write-Host "Tenant: $TenantId"
Write-Host "Modus:  $(if ($NurLesen) { 'nur lesend' } else { 'lesen + gezielte Schreibaktionen' })"
Write-Host ""

Connect-MgGraph -TenantId $TenantId -Scopes @(
    "Application.ReadWrite.All",
    "DelegatedPermissionGrant.ReadWrite.All",
    "Directory.ReadWrite.All"
) -NoWelcome

# --- App und Graph-Dienstprinzipal ermitteln -------------------------------
$app = Get-MgApplication -Filter "appId eq '$ClientId'"
if (-not $app) { throw "App-Registrierung $ClientId nicht gefunden." }

$graphSp = Get-MgServicePrincipal -Filter "appId eq '$GraphAppId'"
$scopeMap = @{}
foreach ($s in $graphSp.Oauth2PermissionScopes) { $scopeMap[$s.Value] = $s.Id }

$unbekannt = $Scopes | Where-Object { -not $scopeMap.ContainsKey($_) }
if ($unbekannt) { throw "Unbekannte Graph-Berechtigungen: $($unbekannt -join ', ')" }

# --- 1. Redirect-URIs (SPA) ------------------------------------------------
$vorhanden = @()
if ($app.Spa -and $app.Spa.RedirectUris) { $vorhanden = $app.Spa.RedirectUris }
$neueUris = ($vorhanden + $RedirectUris) | Select-Object -Unique
Update-MgApplication -ApplicationId $app.Id -Spa @{ redirectUris = $neueUris }
Write-Host "[1/3] SPA-Redirect-URIs gesetzt:" -ForegroundColor Green
$neueUris | ForEach-Object { Write-Host "      $_" }

# --- 2. Benoetigte Berechtigungen eintragen --------------------------------
$resourceAccess = $Scopes | ForEach-Object { @{ id = $scopeMap[$_]; type = "Scope" } }
Update-MgApplication -ApplicationId $app.Id -RequiredResourceAccess @(
    @{ resourceAppId = $GraphAppId; resourceAccess = $resourceAccess }
)
Write-Host "[2/3] $($Scopes.Count) delegierte Berechtigungen eingetragen." -ForegroundColor Green

# --- 3. Administratorzustimmung fuer den Mandanten -------------------------
$sp = Get-MgServicePrincipal -Filter "appId eq '$ClientId'"
if (-not $sp) {
    $sp = New-MgServicePrincipal -AppId $ClientId
    Write-Host "      Dienstprinzipal angelegt."
    Start-Sleep -Seconds 5
}

$grant = Get-MgOauth2PermissionGrant -Filter "clientId eq '$($sp.Id)' and consentType eq 'AllPrincipals'" |
         Where-Object { $_.ResourceId -eq $graphSp.Id } | Select-Object -First 1
$scopeString = ($Scopes | Sort-Object -Unique) -join " "

if ($grant) {
    Update-MgOauth2PermissionGrant -OAuth2PermissionGrantId $grant.Id -Scope $scopeString
} else {
    New-MgOauth2PermissionGrant -BodyParameter @{
        clientId    = $sp.Id
        consentType = "AllPrincipals"
        resourceId  = $graphSp.Id
        scope       = $scopeString
    } | Out-Null
}
Write-Host "[3/3] Administratorzustimmung fuer alle Benutzer erteilt." -ForegroundColor Green

Write-Host ""
Write-Host "Fertig. Naechste Schritte:" -ForegroundColor Cyan
Write-Host "  1. App oeffnen: https://dfedorov12.github.io/compliance/"
Write-Host "  2. Einstellungen -> 'Listen pruefen / anlegen' (legt Listen + Bibliothek an)"
Write-Host "  3. Einstellungen -> Administratoren, DSB, CISO eintragen und speichern"
Write-Host "  4. Einstellungen -> 'Normenkatalog importieren'"
Write-Host "  5. Einstellungen -> 'Berechtigungen pruefen' (zeigt, was der Tenant liefert)"
Write-Host ""
Write-Host "Hinweis: Betroffenenanfragen (Priva) und eDiscovery Premium setzen die" -ForegroundColor Yellow
Write-Host "entsprechende Lizenzierung voraus; ohne sie meldet Graph 403/404." -ForegroundColor Yellow
