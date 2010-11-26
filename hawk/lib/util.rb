#======================================================================
#                        HA Web Konsole (Hawk)
# --------------------------------------------------------------------
#            A web-based GUI for managing and monitoring the
#          Pacemaker High-Availability cluster resource manager
#
# Copyright (c) 2009-2010 Novell Inc., Tim Serong <tserong@novell.com>
#                        All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it would be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
#
# Further, this software is distributed without any warranty that it is
# free of the rightful claim of any third person regarding infringement
# or the like.  Any license provided herein, whether implied or
# otherwise, applies only to this software file.  Patent licenses, if
# any, provided herein do not apply to combinations of this program with
# other software, or any other product whatsoever.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write the Free Software Foundation,
# Inc., 59 Temple Place - Suite 330, Boston MA 02111-1307, USA.
#
#======================================================================

# Random utilities
module Util

  # Derived from Ruby 1.8's and 1.9's lib/open3.rb.  Returns
  # [stdin, stdout, stderr, thread].  thread.value.exitstatus
  # has the exit value of the child, but if you're calling it
  # in non-block form, you need to close stdin, out and err
  # else the process won't be complete when you try to get the
  # exit status.
  def popen3(*cmd)
    pw = IO::pipe   # pipe[0] for read, pipe[1] for write
    pr = IO::pipe
    pe = IO::pipe

    pid = fork{
      # child
      pw[1].close
      STDIN.reopen(pw[0])
      pw[0].close

      pr[0].close
      STDOUT.reopen(pr[1])
      pr[1].close

      pe[0].close
      STDERR.reopen(pe[1])
      pe[1].close

      exec(*cmd)
    }
    wait_thr = Process.detach(pid)

    pw[0].close
    pr[1].close
    pe[1].close
    pi = [pw[1], pr[0], pe[0], wait_thr]
    pw[1].sync = true
    if defined? yield
      begin
        return yield(*pi)
      ensure
        pi.each{|p| p.close if p.respond_to?(:closed) && !p.closed?}
        wait_thr.join
      end
    end
    pi
  end
  module_function :popen3

  # Same as popen3, but sets CRM_USER beforehand
  def run_as(user, *cmd)
    ENV['CRM_USER'] = user
    # crm shell always wants to open/generate help index, so we
    # let it have our tmp directory
    ENV['HOME'] = File.join(RAILS_ROOT, 'tmp')
    pi = popen3(*cmd)
    ENV.delete('CRM_USER')
    if defined? yield
      begin
        return yield(*pi)
      ensure
        pi.each{|p| p.close if p.respond_to?(:closed) && !p.closed?}
      end
    end
    pi
  end
  module_function :run_as

end
