# HerbruClient

HerbruClient ist ein eigenständiges Minecraft-Java-Client- und Launcher-Projekt. Version 0.2.0 enthält einen Electron-Launcher mit dynamischem offiziellem Versionskatalog und Minecraft-spezifische Fabric-Mod-JARs für stabile Releases ab Minecraft 1.20.

## Stand und Kompatibilität

| Bereich | Implementiert | Verifiziert | Status |
| --- | --- | --- | --- |
| Client-Modul | Fabric-Entrypoint und umschaltbare FPS-HUD-Anzeige | Eigene Gradle-Builds für jeden stabilen Release ab 1.20 | Minecraft-spezifische JAR erforderlich; Laufzeit und Spielstart noch nicht freigegeben |
| Launcher | Sicheres Electron-Fenster und offizieller Minecraft-Versionskatalog ab 1.20.0 | TypeScript-Build und Katalogtests | Katalog nutzbar; Installation, Anmeldung und Start folgen |
| Loader | Fabric als aktuelles Kompilierziel | Noch keine Laufzeitmatrix | Forge, NeoForge und Quilt nicht implementiert |
| Modrinth / CurseForge | Noch nicht implementiert | Keine API-Aufrufe | Nicht verfügbar |

### Unterstützte Minecraft-Versionen

Der Launcher verwendet den offiziellen Mojang-Versionskatalog und filtert nur Einträge ab 1.20.0. Der Code erkennt dabei Release-, Snapshot- und weitere Typen, erlaubt aber nur Einträge mit einem gültigen 1.20.0+-Stichtag.

| Typ | Unterstützung | Verifiziert |
| --- | --- | --- |
| Minecraft-Katalog ab 1.20 | Releases, Snapshots und weitere Typen im Launcher | Offizieller Mojang-Katalog |
| Stabile Minecraft-Releases ab 1.20 | Eigene Mod-JAR je Release | Liste wird beim Release-Build aus Mojangs Manifest erstellt |
| Minecraft 1.20 bis 1.21.11 | Ja | Yarn-Mappings und passende Fabric API je Release |
| Minecraft 26.1 und neuer | Ja | Eigener direkter Mojang-Mappings-Build; Java 25 erforderlich |
| Snapshots / Pre-Releases ab 1.20 | Launcher-Katalog ja, Mod-JAR nein | Für den Mod sind nur stabile Releases vorgesehen |
| Versionen vor 1.20.0 | Nein | Nein |

Jede stabile Spielversion benötigt ihre eigene Mod-JAR. Installiere nicht eine JAR für eine andere Minecraft-Version. Ein erfolgreicher Build bestätigt die Kompilierbarkeit, nicht den Laufzeit- oder Spielstart; diese müssen separat getestet werden. Minecraft 26.x verwendet eine geänderte Fabric-Loom- und Rendering-API.

## Voraussetzungen

- Java 25 für Release-Builds inklusive Minecraft 26.x.
- Laufzeit-Java: Minecraft 1.20–1.20.4 benötigt Java 17, 1.20.5–1.21.11 Java 21 und Minecraft 26.x Java 25.
- Node.js 22 oder neuer und npm.
- Gradle Wrapper im Repository; Gradle muss lokal nicht separat installiert sein.
- Für Windows-Installer: Windows x64. Entwicklung und Client-Kompilierung sind auch in GitHub Codespaces vorgesehen.

## GitHub Codespaces

1. Repository in einem Codespace öffnen und den Dev-Container erstellen lassen.
2. Abhängigkeiten installieren: `cd launcher && npm install`.
3. Launcher bauen: `npm run build`.
4. Launcher lokal starten: `npm start` (eine grafische Sitzung muss verfügbar sein).
5. Clientmodul für den Standard-Build bauen: im Repository-Stamm `./gradlew :client:build`.
6. Minecraft-spezifische Release-JARs bauen: `cd launcher && npm run release:client`.
7. Tests ausführen: `cd launcher && npm test`.

Codespaces kann den Client kompilieren. Eine grafische Minecraft-Sitzung oder ein erfolgreicher Spielstart wird in einer Umgebung ohne Desktop nicht vorausgesetzt.

## Launcher

Der Launcher fragt das offizielle Mojang-Versionsmanifest zur Laufzeit ab, bietet Filter für Releases, Snapshots und weitere Manifest-Einträge und blendet Einträge vor Minecraft 1.20 aus. Die Auswahl zeigt Minecraft-Versionen; das dazu passende Herbru-Mod-Artefakt wird im Release separat für jeden stabilen Release gebaut. Die Versionsdaten werden im Electron-Hauptprozess geladen; der Renderer erhält nur eine schmale IPC-API. Node-Integration ist deaktiviert, Context Isolation und Sandbox sind aktiviert.

Der PLAY-Button ist in diesem Grundstand absichtlich nicht verfügbar: Authentifizierung, Installation und Startvalidierung sind noch nicht implementiert. Es werden weder Zugangsdaten noch erfundene Installationszustände verwendet.

Windows-Pakete: `cd launcher && npm run dist:win`. Paketieren für Windows sollte auf einem Windows-Runner erfolgen.

## Client-Mod

Das Fabric-Modul registriert H zum Ein- und Ausschalten einer FPS-Anzeige. Release-JARs werden automatisch für alle zum Build-Zeitpunkt im offiziellen Mojang-Manifest aufgeführten stabilen Versionen ab 1.20 erstellt. Bis einschließlich Minecraft 1.21.11 werden Yarn-Mappings benutzt; für 26.x werden Minecrafts direkte Mojang-Namen und die neue Fabric HUD-API verwendet. Die Datei `release/HerbruClient-v<version>/client-variants.json` listet exakte Minecraft-, Java-, Loader- und Fabric-API-Versionen sowie SHA-256-Prüfsummen jeder JAR.

## Entwicklung und Releases

- Launcher-Entwicklung: `cd launcher && npm run build && npm start`
- Launcher-Tests: `cd launcher && npm test`
- Fabric-Mod bauen: `./gradlew :client:build`
- Version-spezifische Fabric-JARs bauen: `cd launcher && npm run release:client`
- Client-Download-Artefakte vorbereiten: `cd launcher && npm run client:download`
- Release-Paket für Launcher und Client erzeugen: `cd launcher && npm run prepare-release`
- Windows x64 paketieren: `cd launcher && npm run dist:win`
- CI: GitHub Actions baut Launcher und Clientmodul und führt die Launcher-Tests aus.

Der Befehl `npm run prepare-release` erzeugt ein nutzbares Paket unter `release/HerbruClient-<timestamp>/` mit:
- `launcher/` für den Launcher-Build
- `client/` für die fertige Fabric-JAR
- `manifest.json` mit Installationshinweisen

`npm run client:download` erzeugt zusätzlich ein Download-Manifest in `release/downloads/client/client-download.json`.

Tags im Format `v<launcher-version>` starten den GitHub-Release-Workflow. Er baut alle stabilen Minecraft-JARs aus Mojangs aktuellem Manifest, paketiert den Windows-Launcher und veröffentlicht Release-Notizen und Dateien. Microsoft-OAuth, sichere Token-Speicherung, Modrinth, CurseForge, Modpacks, Instanzen und zusätzliche Loader sind offene Ausbaustufen. Für Microsoft-Anmeldung ist später eine eigene OAuth-App-Registrierung mit geeigneter Redirect-Konfiguration notwendig; Geheimnisse dürfen nicht in Renderer oder Repository gelangen.

## Fehlerbehebung

- Bei Gradle-Fehlern Java 25 verwenden und mit `./gradlew :client:build --stacktrace` wiederholen.
- Der Versionskatalog benötigt eine Netzwerkverbindung zu `piston-meta.mojang.com`.
- `npm ci` verwendet die eingecheckte Lockdatei; nach absichtlichen Abhängigkeitsänderungen `npm install` ausführen.
- Launcher-Probleme in der Entwicklerversion werden in der Electron-Konsole ausgegeben. Tokens werden in diesem Stand nicht verarbeitet.

## Lizenz und Drittanbieter

Minecraft ist Eigentum von Mojang/Microsoft. HerbruClient ist unabhängig und weder mit Mojang noch Microsoft verbunden. Der Launcher lädt in diesem Stand ausschließlich Metadaten des offiziellen Minecraft-Manifests. Fabric Loader, Fabric API, Gradle, Electron und TypeScript unterliegen jeweils ihren eigenen Lizenzen; ihre Lizenztexte sind nicht Bestandteil dieses Quellstands.