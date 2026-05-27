using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

class Program
{
    static void Main()
    {
        var exeDir = AppDomain.CurrentDomain.BaseDirectory;
        var serverJs = Path.Combine(exeDir, "server.js");
        var workingDir = exeDir;

        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.Title = "Asuka AI - 酱味大鸡";

        Console.WriteLine("正在启动 Asuka AI...");

        var psi = new ProcessStartInfo
        {
            FileName = "node",
            Arguments = "\"" + serverJs + "\"",
            WorkingDirectory = workingDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        Process p;
        try
        {
            p = Process.Start(psi);
        }
        catch (Exception ex)
        {
            Console.WriteLine("启动失败: " + ex.Message);
            Console.WriteLine("请确保已安装 Node.js (https://nodejs.org)");
            Console.WriteLine("按任意键退出...");
            Console.ReadKey();
            return;
        }

        p.OutputDataReceived += (s, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data))
            {
                Console.WriteLine(e.Data);
            }
        };
        p.ErrorDataReceived += (s, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data))
            {
                Console.Error.WriteLine(e.Data);
            }
        };
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();

        // 等服务器就绪后打开浏览器
        Thread.Sleep(3000);
        try
        {
            Process.Start("http://localhost:3000");
        }
        catch { }

        Console.WriteLine();
        Console.WriteLine("Asuka AI 已启动: http://localhost:3000");
        Console.WriteLine("关闭此窗口即可停止服务。");
        Console.WriteLine();

        p.WaitForExit();
    }
}
