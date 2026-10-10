package de.heibru.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

public final class HeibruClient implements ClientModInitializer {
    private static boolean hudVisible = true;

    @Override
    public void onInitializeClient() {
        KeyBinding toggleHud = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.heibruclient.toggle_hud",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_H,
                "category.heibruclient"
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (toggleHud.wasPressed()) {
                hudVisible = !hudVisible;
            }
        });

        HudRenderCallback.EVENT.register((drawContext, tickDelta) -> {
            MinecraftClient client = MinecraftClient.getInstance();
            if (!hudVisible || client.player == null) {
                return;
            }

            drawContext.drawTextWithShadow(
                    client.textRenderer,
                    "HeibruClient | FPS " + client.getCurrentFps(),
                    8,
                    8,
                    0xEAF5E8
            );
        });
    }
}