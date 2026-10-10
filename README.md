# HerbruClient

HerbruClient ist ein eigenständiges Minecraft-Java-Client- und Launcher-Projekt. Dieser überprüfbare Grundstand enthält ein Fabric-Clientmodul für Minecraft 1.20.1, einen Electron-Launcher mit dynamischem offiziellen Versionskatalog sowie Builds und automatisierte Tests.

## Stand und Kompatibilität

| Bereich | Implementiert | Verifiziert | Status |
| --- | --- | --- | --- |
| Client-Modul | Fabric-Entrypoint und umschaltbare FPS-HUD-Anzeige | Gradle-Kompilierung für Minecraft 1.20.1 | Laufzeit und Spielstart noch nicht freigegeben |
| Launcher | Sicheres Electron-Fenster und offizieller Minecraft-Versionskatalog ab 1.20.0 | TypeScript-Build und Katalogtests | Katalog nutzbar; Installation, Anmeldung und Start folgen |
| Loader | Fabric als aktuelles Kompilierziel | Noch keine Laufzeitmatrix | Forge, NeoForge und Quilt nicht implementiert |
| Modrinth / CurseForge | Noch nicht implementiert | Keine API-Aufrufe | Nicht verfügbar |

### Unterstützte Minecraft-Versionen

Der Launcher verwendet den offiziellen Mojang-Versionskatalog und filtert nur Einträge ab 1.20.0. Der Code erkennt dabei Release-, Snapshot- und weitere Typen, erlaubt aber nur Einträge mit einem gültigen 1.20.0+-Stichtag.

| Typ | Unterstützung | Verifiziert |
| --- | --- | --- |
| Minecraft 1.20.0 und neuer | Ja | Ja, durch den Katalogfilter und das Buildziel 1.20.1 |
| Minecraft 1.20.1 | Ja | Ja, als aktuelles kompilierbares Ziel |
| Spätere Releases ab 1.20.0 | Ja | Ja, durch dynamischen Katalog |
| Snapshots ab 1.20.0 | Ja | Ja, sofern Mojang sie im Manifest ausweist |
| Versionen vor 1.20.0 | Nein | Nein |

Eine erfolgreiche Kompilierung ist keine bestätigte Spielkompatibilität. Eine Version wird erst als unterstützt ausgewiesen, wenn Installation, Konfiguration und Start getestet sind. Snapshots erscheinen getrennt von Releases; weitere Typen nur, wenn Mojang sie im Manifest ausweist.

## Voraussetzungen

- Java 21 für den Entwicklungsprozess; das Clientmodul erzeugt Java-17-kompatiblen Bytecode.
- Node.js 22 oder neuer und npm.
- Gradle Wrapper im Repository; Gradle muss lokal nicht separat installiert sein.
- Für Windows-Installer: Windows x64. Entwicklung und Client-Kompilierung sind auch in GitHub Codespaces vorgesehen.

## GitHub Codespaces

1. Repository in einem Codespace öffnen und den Dev-Container erstellen lassen.
2. Abhängigkeiten installieren: `cd launcher && npm install`.
3. Launcher bauen: `npm run build`.
4. Launcher lokal starten: `npm start` (eine grafische Sitzung muss verfügbar sein).
5. Clientmodul bauen: im Repository-Stamm `./gradlew :client:build`.
6. Tests ausführen: `cd launcher && npm test`.

Codespaces kann den Client kompilieren. Eine grafische Minecraft-Sitzung oder ein erfolgreicher Spielstart wird in einer Umgebung ohne Desktop nicht vorausgesetzt.

## Launcher

Der Launcher fragt das offizielle Mojang-Versionsmanifest zur Laufzeit ab, bietet Filter für Releases, Snapshots und alle Manifest-Einträge und blendet Einträge vor Minecraft 1.20.0 aus. Die Versionsdaten werden im Electron-Hauptprozess geladen; der Renderer erhält nur eine schmale IPC-API. Node-Integration ist deaktiviert, Context Isolation und Sandbox sind aktiviert.

Der PLAY-Button ist in diesem Grundstand absichtlich nicht verfügbar: Authentifizierung, Installation und Startvalidierung sind noch nicht implementiert. Es werden weder Zugangsdaten noch erfundene Installationszustände verwendet.

Windows-Pakete: `cd launcher && npm run dist:win`. Paketieren für Windows sollte auf einem Windows-Runner erfolgen.

## Client-Mod

Das Fabric-Modul registriert H zum Ein- und Ausschalten einer FPS-Anzeige. Es ist ein echtes Fabric-Entrypoint-Modul, kein Mockup. Minecraft- und Fabric-Versionen sind vorerst auf das geprüfte Kompilierziel 1.20.1 festgelegt; der dynamische Launcher-Katalog bedeutet nicht, dass andere Versionen bereits unterstützt werden.

## Entwicklung und Releases

- Launcher-Entwicklung: `cd launcher && npm run build && npm start`
- Launcher-Tests: `cd launcher && npm test`
- Fabric-Mod bauen: `./gradlew :client:build`
- Client-Download-Artefakte vorbereiten: `cd launcher && npm run client:download`
- Release-Paket für Launcher und Client erzeugen: `cd launcher && npm run prepare-release`
- Windows x64 paketieren: `cd launcher && npm run dist:win`
- CI: GitHub Actions baut Launcher und Clientmodul und führt die Launcher-Tests aus.

Der Befehl `npm run prepare-release` erzeugt ein nutzbares Paket unter `release/HerbruClient-<timestamp>/` mit:
- `launcher/` für den Launcher-Build
- `client/` für die fertige Fabric-JAR
- `manifest.json` mit Installationshinweisen

`npm run client:download` erzeugt zusätzlich ein Download-Manifest in `release/downloads/client/client-download.json`.

Ein Release-Workflow und automatische Updates sind noch nicht eingerichtet. Microsoft-OAuth, sichere Token-Speicherung, Modrinth, CurseForge, Modpacks, Instanzen und zusätzliche Loader sind offene Ausbaustufen. Für Microsoft-Anmeldung ist später eine eigene OAuth-App-Registrierung mit geeigneter Redirect-Konfiguration notwendig; Geheimnisse dürfen nicht in Renderer oder Repository gelangen.

## Fehlerbehebung

- Bei Gradle-Fehlern Java 21 verwenden und mit `./gradlew :client:build --stacktrace` wiederholen.
- Der Versionskatalog benötigt eine Netzwerkverbindung zu `piston-meta.mojang.com`.
- `npm ci` verwendet die eingecheckte Lockdatei; nach absichtlichen Abhängigkeitsänderungen `npm install` ausführen.
- Launcher-Probleme in der Entwicklerversion werden in der Electron-Konsole ausgegeben. Tokens werden in diesem Stand nicht verarbeitet.

## Lizenz und Drittanbieter

Minecraft ist Eigentum von Mojang/Microsoft. HerbruClient ist unabhängig und weder mit Mojang noch Microsoft verbunden. Der Launcher lädt in diesem Stand ausschließlich Metadaten des offiziellen Minecraft-Manifests. Fabric Loader, Fabric API, Gradle, Electron und TypeScript unterliegen jeweils ihren eigenen Lizenzen; ihre Lizenztexte sind nicht Bestandteil dieses Quellstands.