package de.herbru.client;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;

public final class HerbruClient implements ClientModInitializer {
    private static boolean hudVisible = true;

    @Override
    public void onInitializeClient() {
        KeyMapping toggleHud = KeyMappingHelper.registerKeyMapping(new KeyMapping(
                "key.herbruclient.toggle_hud",
                InputConstants.Type.KEYBOARD,
                InputConstants.KEY_H,
                KeyMapping.Category.MISC
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (toggleHud.consumeClick()) {
                hudVisible = !hudVisible;
            }
        });

        HudElementRegistry.attachElementAfter(
                VanillaHudElements.CROSSHAIR,
                Identifier.fromNamespaceAndPath("herbruclient", "fps_hud"),
                (graphics, deltaTracker) -> {
                    Minecraft client = Minecraft.getInstance();
                    if (hudVisible && client.player != null) {
                        graphics.text(
                                client.font,
                                "HerbruClient | FPS " + client.getFps(),
                                8,
                                8,
                                0xEAF5E8
                        );
                    }
                }
        );
    }
}
