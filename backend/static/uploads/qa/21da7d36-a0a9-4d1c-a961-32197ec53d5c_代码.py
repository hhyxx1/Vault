import pandas as pd
import matplotlib.pyplot as plt
import math

# 定义函数展示交互界面选项
def show_menu():
    print("欢迎来到成绩管理系统")
    print("1. 查看各科平均分、最高分和最低分")
    print("2. 查看数学成绩各等级人数分布")
    print("3. 查看各科平均分柱状图")
    print("4. 退出系统")

# 尝试读取Excel文件中的成绩数据
try:
    file_path ='scores.xlsx'
    sheet_name ='scores'
    df = pd.read_excel(file_path, sheet_name)
    data = df.values.tolist()
except FileNotFoundError:
    print(f"找不到路径为 {file_path} 的文件，请核实文件名和路径是否正确。")
    raise (Exception)

# 初始化列表，用于统计数学成绩各等级人数
math_grade_buckets = [0] * 5
# 遍历数据统计数学成绩各等级人数
for i in range(0, len(data), 2):
    score = data[i][3]
    if score < 60:
        math_grade_buckets[0] += 1
    elif score < 70:
        math_grade_buckets[1] += 1
    elif score < 80:
        math_grade_buckets[2] += 1
    elif score < 90:
        math_grade_buckets[3] += 1
    else:
        math_grade_buckets[4] += 1

# 分别计算数学和英语的总分与科目数量
math_total_score = 0
english_total_score = 0
math_subject_count = 0
english_subject_count = 0
for i in range(0, len(data), 2):
    math_total_score += data[i][3]
    math_subject_count += 1
for i in range(1, len(data), 2):
    english_total_score += data[i][3]
    english_subject_count += 1

# 计算数学和英语的平均分
math_average_score = math_total_score / math_subject_count if math_subject_count > 0 else 0
english_average_score = english_total_score / english_subject_count if english_subject_count > 0 else 0

show_menu()
while True:
    try:
        user_choice = int(input("请输入对应的操作数字: "))
        if user_choice == 1:
            print(f"数学平均分为{math_average_score:.2f}，英语平均分为{english_average_score:.2f}")
            # 这里如果要统计最高分最低分可补充相应逻辑
        elif user_choice == 2:
            plt.pie(math_grade_buckets, labels=["不合格", "合格", "中等", "良好", "优秀"])
            plt.title("数学成绩各等级人数分布")
            plt.rcParams['font.sans-serif'] = 'SimSun'
            plt.show()
        elif user_choice == 3:
            plt.bar(["数学", "英语"], [math_average_score, english_average_score])
            plt.title("各科平均分柱状图")
            plt.rcParams['font.sans-serif'] = 'SimSun'
            plt.show()
        elif user_choice == 4:
            print("感谢使用本成绩管理系统，祝你生活愉快！")
            break
        else:
            print("您输入的数字不在选项范围内，请重新输入。")
    except ValueError:
        print("请输入有效的整数选项。")