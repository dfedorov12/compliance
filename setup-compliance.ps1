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
    Benoetigt nur das Modul Microsoft.Graph.Authentication (nicht das komplette
    Microsoft.Graph-Paket). Alle Aufrufe laufen direkt per Invoke-MgGraphRequest.
        Install-Module Microsoft.Graph.Authentication -Scope CurrentUser
#>

param(
    [string]$ClientId = "a129024b-8b1a-4d54-89f4-8e6049b5f59b",
    [string]$TenantId = "fdb70646-023a-403b-a4b9-1f474a935123",
    [string[]]$RedirectUris = @(
        "https://dfedorov12.github.io/compliance/",
        "http://localhost:8771/"
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
    "Sites.Manage.All"                       # Listen und Spalten anlegen (Einstellungen)
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

if (-not (Get-Command Invoke-MgGraphRequest -ErrorAction SilentlyContinue)) {
    throw "Modul Microsoft.Graph.Authentication fehlt. Installieren mit: Install-Module Microsoft.Graph.Authentication -Scope CurrentUser"
}

Connect-MgGraph -TenantId $TenantId -Scopes @(
    "Application.ReadWrite.All",              # App-Registrierung aendern, Dienstprinzipal anlegen
    "DelegatedPermissionGrant.ReadWrite.All"  # Administratorzustimmung erteilen
) -NoWelcome

# Direkter REST-Aufruf gegen Graph v1.0. Dadurch reicht das Modul
# Microsoft.Graph.Authentication; Get-MgApplication & Co. werden nicht gebraucht.
function Invoke-Graph([string]$Methode, [string]$Pfad, $Body = $null) {
    $param = @{
        Method     = $Methode
        Uri        = "https://graph.microsoft.com/v1.0$Pfad"
        OutputType = "PSObject"
    }
    if ($null -ne $Body) {
        $param.Body        = ($Body | ConvertTo-Json -Depth 10)
        $param.ContentType = "application/json"
    }
    Invoke-MgGraphRequest @param
}

# --- App und Graph-Dienstprinzipal ermitteln -------------------------------
$app = (Invoke-Graph GET "/applications?`$filter=appId eq '$ClientId'").value | Select-Object -First 1
if (-not $app) { throw "App-Registrierung $ClientId nicht gefunden." }

$graphSp = (Invoke-Graph GET "/servicePrincipals?`$filter=appId eq '$GraphAppId'&`$select=id,oauth2PermissionScopes").value |
           Select-Object -First 1
$scopeMap = @{}
foreach ($s in $graphSp.oauth2PermissionScopes) { $scopeMap[$s.value] = $s.id }

$unbekannt = $Scopes | Where-Object { -not $scopeMap.ContainsKey($_) }
if ($unbekannt) { throw "Unbekannte Graph-Berechtigungen: $($unbekannt -join ', ')" }

# --- 1. Redirect-URIs (SPA) ------------------------------------------------
$vorhanden = @()
if ($app.spa -and $app.spa.redirectUris) { $vorhanden = @($app.spa.redirectUris) }
$neueUris = @(($vorhanden + $RedirectUris) | Select-Object -Unique)
Invoke-Graph PATCH "/applications/$($app.id)" @{ spa = @{ redirectUris = $neueUris } } | Out-Null
Write-Host "[1/3] SPA-Redirect-URIs gesetzt:" -ForegroundColor Green
$neueUris | ForEach-Object { Write-Host "      $_" }

# --- 2. Benoetigte Berechtigungen eintragen --------------------------------
# Eintraege fuer andere APIs und etwaige Graph-Anwendungsrollen bleiben erhalten,
# ersetzt werden nur die delegierten Graph-Berechtigungen.
$andereApis  = @($app.requiredResourceAccess | Where-Object { $_.resourceAppId -ne $GraphAppId })
$graphAlt    = $app.requiredResourceAccess | Where-Object { $_.resourceAppId -eq $GraphAppId } | Select-Object -First 1
$graphRollen = @()
if ($graphAlt) { $graphRollen = @($graphAlt.resourceAccess | Where-Object { $_.type -eq "Role" }) }

$delegiert = @($Scopes | Sort-Object -Unique | ForEach-Object { @{ id = $scopeMap[$_]; type = "Scope" } })
$graphEintrag = @{ resourceAppId = $GraphAppId; resourceAccess = @($delegiert + $graphRollen) }

Invoke-Graph PATCH "/applications/$($app.id)" @{ requiredResourceAccess = @($andereApis + $graphEintrag) } | Out-Null
Write-Host "[2/3] $($delegiert.Count) delegierte Berechtigungen eingetragen." -ForegroundColor Green

# --- 3. Administratorzustimmung fuer den Mandanten -------------------------
$sp = (Invoke-Graph GET "/servicePrincipals?`$filter=appId eq '$ClientId'").value | Select-Object -First 1
if (-not $sp) {
    $sp = Invoke-Graph POST "/servicePrincipals" @{ appId = $ClientId }
    Write-Host "      Dienstprinzipal angelegt."
    Start-Sleep -Seconds 5
}

$grant = (Invoke-Graph GET "/oauth2PermissionGrants?`$filter=clientId eq '$($sp.id)' and consentType eq 'AllPrincipals'").value |
         Where-Object { $_.resourceId -eq $graphSp.id } | Select-Object -First 1
$scopeString = ($Scopes | Sort-Object -Unique) -join " "

if ($grant) {
    Invoke-Graph PATCH "/oauth2PermissionGrants/$($grant.id)" @{ scope = $scopeString } | Out-Null
} else {
    Invoke-Graph POST "/oauth2PermissionGrants" @{
        clientId    = $sp.id
        consentType = "AllPrincipals"
        resourceId  = $graphSp.id
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
