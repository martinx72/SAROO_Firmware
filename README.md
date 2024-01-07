# SAROO Firmware

<pre><code class="fenced-code-block language-SAROO">Base: tpunix, xvortex on github
Enhance: martinx72, psplandy on github
Kaito Gaming Group on Facebook:
   https://www.facebook.com/groups/GameKaito
Note:
   This program is freeware, if you paid for it you have been scammed.
   Kaito team does not make any Saroo hardware and sell it!
</code></pre>

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/rgrdev)&nbsp;&nbsp;&nbsp;&nbsp;[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I1J3G3I)



&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://github.com/martinx72/SAROO_Firmware/blob/09ebe1ff1cbf52a99284ff4a69d700a4839aedc2/demo_gif/2024010718085950%20%5BAVC%20720p%5D%20%5B640i%5D.gif" width="320"/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://github.com/martinx72/SAROO_Firmware/blob/09ebe1ff1cbf52a99284ff4a69d700a4839aedc2/demo_gif/2024010718044765%20%5BAVC%20720p%5D%20%5B640i%5D.gif" width="320"/>

# SAROO Firmware files

Please make sure your cartridge came with FPGA:**05** and MCU:**231125** or later. If not, please contact your sourcer to make sure it has been updated.

And, you can alwasy get the latest updated firmware here: https://github.com/martinx72/SAROO_Firmware/

A SD Card basic layout should be as follow:

<pre><code class="fenced-code-block language-SAROO">[SD card root folder]
  + [SAROO]
      + ssfirm.bin
      + saroocfg.txt
      + mcuapp.bin
  + [BIN]
  + [ISO]
  + [update]
</code></pre>

Regards game image files:

Game ISO or CUE+BIN files must be place inside ISO sub folder, and you must make one folder for one singal game as follow.

<pre><code class="fenced-code-block language-SAROO">[SD card root folder]
  + [SAROO]
  + [ISO]
      + [Game0]
          + game0.iso
      + [Game1] 
          + game1.cue
          + game1.bin
      + [Game2] 
          + game2.iso
      + [Game3] 
          + game3.cue
          + game3.img
</code></pre>

# SAROO Config file major setting

<pre><code class="fenced-code-block language-SAROO"># SAROO config file
# avaiable:
#   lang_id=x
#     Language supported:  
#          0: 中文  
#          1: English 
#          2: Portuguese (Brazil)
#          3: Japanese 
#          4: Russian 
#          5: Chinese(Taiwan) 
#          6: French
#   auto_update:
#     MCU if it is existed on sd card
#   play_delay=xxxx
#     Delay time before CD launch, unit: us, in decimal
#   sector_delay=xxxx
#     Delay time after each sector of CD reading, unit: us, in decimal
#   exmem_1M
#     enable 1M RAM cart built-in feature
#   exmem_4M
#     enable 4M RAM cart built-in feature
#   M_xxxxxxxx=xxxxxxxx
#     Modify RAM content in 32bit format
#   M_xxxxxxxx=xxxx
#     Modify RAM content in 16bit format
#   M_xxxxxxxx=xx
#     Modify RAM content in 8bit format
#   debug=xxxxxxxx
#     setting special flags for debuging
#  [global] section is global settins
[global]
lang_id = 1
exmem_4M

# TAROMARU         太郎丸
[T-4804G   V1.004]
sector_delay=1000

# SALAMANDER-DP    沙罗曼蛇合集
[T-9520G   V1.010]
sector_delay=2000
</code></pre>
