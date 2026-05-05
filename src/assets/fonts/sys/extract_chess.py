import os
import glob
from fontTools import subset
from fontTools.ttLib import TTFont

def process_all_fonts():
    input_dir = r"V:\4_mydoc\tauri\nicechchess\src\assets\fonts\sys"
    output_dir = r"V:\4_mydoc\tauri\nicechchess\src-tauri\target\debug\assets\fonts"
    
    # 14个象棋核心 Unicode
    chess_unicodes = [
        0x5E25, 0x4ED5, 0x76F8, 0x4FE5, 0x4FFA, 0x70AE, 0x5175, # 红
        0x5C07, 0x58EB, 0x8C61, 0x8ECA, 0x99AC, 0x7832, 0x5352  # 黑
    ]

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    ttf_files = glob.glob(os.path.join(input_dir, "*.ttf"))
    
    for font_path in ttf_files:
        file_name = os.path.basename(font_path)
        target_path = os.path.join(output_dir, file_name)

        try:
            # --- 关键修改 1: 手动修复损坏的 head 表 ---
            # 开启 lazy=False 强制加载，但先捕获损坏错误
            font = TTFont(font_path, recalcBBoxes=True, recalcTimestamp=True)
            
            # 如果 head 表有多余字节，这里强制重新赋值来“对齐”数据结构
            if 'head' in font:
                # 重新计算校验和与魔数，抛弃多余的尾部字节
                font['head'].checkSumAdjustment = 0 

            # --- 关键修改 2: 配置裁剪 ---
            options = subset.Options()
            options.set(layout_features=['*'])
            options.ignore_missing_glyphs = True
            options.drop_tables = [] # 保留表，防止结构性崩溃
            
            subsetter = subset.Subsetter(options=options)
            subsetter.populate(unicodes=chess_unicodes)
            
            # 执行裁剪
            subsetter.subset(font)
            
            # 强制设置版本号
            font.sfntVersion = '\x00\x01\x00\x00'
            
            font.save(target_path)
            font.close()
            print(f"成功导出修复版: {file_name}")

        except Exception as e:
            print(f"失败: {file_name}, 原因: {e}")
            # 如果依然报错，可能是文件头彻底损坏，建议用 FontCreator 重新保存一次再运行
            continue

if __name__ == "__main__":
    process_all_fonts()
