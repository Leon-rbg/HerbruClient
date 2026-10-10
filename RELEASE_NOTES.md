# HeibruClient 0.2.0

## Neu in dieser Version

- Der Launcher zeigt stabile Minecraft-Releases ab 1.20 aus dem offiziellen Mojang-Versionsmanifest.
- Für jeden stabilen Minecraft-Release wird eine eigene Fabric-Mod-JAR gebaut; die Minecraft-Version steht im Dateinamen und in den Mod-Metadaten.
- Minecraft 26.x wird mit der aktuellen nicht-remappenden Fabric-Loom-Variante, Mojangs direkten Klassennamen und der neuen Fabric-HUD-API gebaut.
- Die erforderliche Java-Version wird je Version aus Mojangs Metadaten ermittelt: Java 17 für 1.20–1.20.4, Java 21 für 1.20.5–1.21.11 und Java 25 für 26.x.
- Das Release-Manifest enthält Loader- und Fabric-API-Versionen, Dateigrößen und SHA-256-Prüfsummen für alle JARs.
- Versionsanzeige und Paketversion im Launcher wurden aktualisiert.

## Kompatibilität und Hinweise

- Nur stabile Minecraft-Releases ab 1.20 erhalten eine HeibruClient-JAR. Snapshots und Pre-Releases sind nicht Teil der Mod-Buildmatrix.
- Verwende ausschließlich die JAR, deren Minecraft-Version exakt zu deiner Spielversion passt.
- Der Launcher-Build und die Mod-Kompilierung bestätigen nicht automatisch den Spielstart. Authentifizierung und vollständiger Spielstart sind weiterhin nicht implementiert.
- Der Windows-Launcher wird als x64-Installer und portable Anwendung bereitgestellt.
